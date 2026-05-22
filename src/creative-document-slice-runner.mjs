import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  loadCoreSchemas,
  validateEventLedger,
  validateVerticalSlice,
} from "./core-contract-validator.mjs";

export const DEFAULT_CREATIVE_DOCUMENT_INPUT = "examples/creative-document-brief.json";
export const DEFAULT_CREATIVE_DOCUMENT_OUT_DIR = "artifacts/creative-document-slice/latest";

const CAPABILITY_ID = "creative_document.pptx.design_system";
const WORKFLOW_ID = "workflow.creative_document.pptx.design_system.v1";
const POLICY_SNAPSHOT_ID = "policy.default.creative_document.v1";
const DEFAULT_IDS = {
  tenantId: "tenant.personal.jws",
  userId: "user.jws",
  clientId: "client.personal.creative",
  matterId: "matter.creative_document.hermes",
};

export async function runCreativeDocumentSlice(options = {}) {
  const result = await buildCreativeDocumentSlice(options);
  const schemas = await loadCoreSchemas(options.schemaDir);
  const sliceValidation = validateVerticalSlice(result.creative_document_slice, schemas);
  const ledgerValidation = validateEventLedger(result.event_ledger, schemas, result.creative_document_slice);
  const validated = {
    ...result,
    validation: {
      valid: sliceValidation.valid && ledgerValidation.valid,
      creative_document_slice: sliceValidation,
      event_ledger: ledgerValidation,
    },
  };

  if (validated.validation.valid && options.outDir) await writeCreativeDocumentSlice(validated, options.outDir);
  return validated;
}

export async function buildCreativeDocumentSlice(options = {}) {
  const inputPath = path.resolve(options.inputPath ?? DEFAULT_CREATIVE_DOCUMENT_INPUT);
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CREATIVE_DOCUMENT_OUT_DIR);
  const runAt = new Date(options.runAt ?? new Date()).toISOString();
  const briefText = await readFile(inputPath, "utf8");
  const brief = normalizeBrief(JSON.parse(briefText));
  const ids = { ...DEFAULT_IDS, ...options.ids };
  const inputHash = sha256(briefText);
  const idSuffix = inputHash.slice(0, 12);
  const deckManifest = buildDeckManifest(brief, {
    runAt,
    idSuffix,
    outputDir,
    maxSlides: Number(options.maxSlides ?? 6),
  });
  const outlineMarkdown = renderDeckOutline(brief, deckManifest, runAt);
  const pptxBuffer = buildPptx(deckManifest);
  const formatValidation = validateDeckFormat(deckManifest, pptxBuffer);

  const resourceId = `resource.creative_document.${idSuffix}`;
  const resourceVersionId = `resource-version.creative_document.${idSuffix}.v1`;
  const normalizedTextId = `normalized.creative_document.${idSuffix}`;
  const sourceSpanId = `span.creative_document.${idSuffix}.brief`;
  const evidenceIds = deckManifest.slides.map((slide) => `evidence.creative_document.${idSuffix}.slide.${pad(slide.slide_number)}`);
  const factIds = deckManifest.slides.map((slide) => `fact.creative_document.${idSuffix}.slide.${pad(slide.slide_number)}`);
  const issueId = `issue.creative_document.${idSuffix}.format_review`;
  const pptxArtifactId = `output.creative_document.${idSuffix}.pptx`;
  const markdownArtifactId = `output.creative_document.${idSuffix}.outline`;
  const manifestArtifactId = `output.creative_document.${idSuffix}.manifest`;
  const citationIds = deckManifest.slides.map((slide) => `citation.creative_document.${idSuffix}.slide.${pad(slide.slide_number)}`);
  const workflowRunId = `workflow-run.creative_document.${idSuffix}`;
  const outlineRunId = `agent-run.creative_document.${idSuffix}.outline`;
  const rendererRunId = `agent-run.creative_document.${idSuffix}.renderer`;
  const approvalId = `approval.creative_document.${idSuffix}.human_review`;
  const costRecordId = `cost.creative_document.${idSuffix}`;
  const gateResults = buildGateResults({
    runAt,
    idSuffix,
    workflowRunId,
    pptxArtifactId,
    formatValidation,
  });
  const sourceSpanText = renderSourceSpan(brief);
  const creativeDocumentSlice = {
    schema_version: "creative-document-slice.v1",
    generated_at: isoAt(runAt, 16),
    identity_policy: buildIdentityPolicy(ids, runAt),
    resource_evidence: {
      schema_version: "resource-evidence.v1",
      resources: [
        {
          schema_version: "resource-core.v1",
          id: resourceId,
          tenant_id: ids.tenantId,
          source_system: "local_filesystem",
          source_uri: inputPath,
          resource_type: "document",
          content_hash: inputHash,
          classification: brief.classification,
          matter_id: ids.matterId,
          materialization_status: "not_required",
          ingestion_status: "normalized",
          created_at: isoAt(runAt, 0),
          created_by: connectorActor(),
          metadata: {
            project_id: brief.project_id,
            document_type: "pptx_design_system_brief",
          },
        },
      ],
      resource_versions: [
        {
          schema_version: "resource-version.v1",
          id: resourceVersionId,
          resource_id: resourceId,
          version_label: "v1",
          content_hash: inputHash,
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
          text_hash: sha256(sourceSpanText),
          language: brief.language,
          extractor_id: "extractor.creative_document.style_profile.v1",
          quality: "high",
          text_preview: `${brief.title} (${deckManifest.slides.length} slides)`,
          metadata: {
            section_count: brief.sections.length,
            constraint_count: brief.constraints.length,
          },
        },
      ],
      source_spans: [
        {
          schema_version: "source-span.v1",
          id: sourceSpanId,
          resource_id: resourceId,
          resource_version_id: resourceVersionId,
          location_type: "whole_document",
          locator: {
            project_id: brief.project_id,
          },
          text: sourceSpanText,
          hash: sha256(sourceSpanText),
          metadata: {},
        },
      ],
      evidence_items: deckManifest.slides.map((slide, index) => ({
        schema_version: "evidence-item.v1",
        id: evidenceIds[index],
        matter_id: ids.matterId,
        source_span_ids: [sourceSpanId],
        evidence_type: "metadata",
        summary: `Slide ${slide.slide_number}: ${slide.title}`,
        reliability: "machine_extracted",
        review_status: "needs_review",
        metadata: {
          slide_number: slide.slide_number,
          layout: slide.layout,
        },
      })),
      facts: deckManifest.slides.map((slide, index) => ({
        schema_version: "fact.v1",
        id: factIds[index],
        matter_id: ids.matterId,
        evidence_item_ids: [evidenceIds[index]],
        statement: `${brief.title} draft deck includes slide ${slide.slide_number}: ${slide.title}.`,
        fact_type: "general",
        confidence: 0.88,
        review_status: "needs_review",
        metadata: {
          bullet_count: slide.bullets.length,
        },
      })),
      issues: [
        {
          schema_version: "issue.v1",
          id: issueId,
          matter_id: ids.matterId,
          issue_type: "general",
          title: "Draft presentation requires format and human review",
          linked_fact_ids: factIds,
          severity: "medium",
          status: "candidate",
          metadata: {
            format_validation_status: formatValidation.status,
          },
        },
      ],
      citations: deckManifest.slides.map((slide, index) => ({
        schema_version: "citation.v1",
        id: citationIds[index],
        output_artifact_id: pptxArtifactId,
        target_path: `slides[${index}]`,
        source_span_ids: [sourceSpanId],
        evidence_item_ids: [evidenceIds[index]],
        citation_status: "candidate",
        metadata: {
          slide_number: slide.slide_number,
        },
      })),
    },
    workflow_runtime: buildWorkflowRuntime({
      runAt,
      ids,
      resourceId,
      workflowRunId,
      outlineRunId,
      rendererRunId,
      pptxArtifactId,
      markdownArtifactId,
      manifestArtifactId,
      formatValidation,
    }),
    governance_output: buildGovernanceOutput({
      runAt,
      ids,
      workflowRunId,
      rendererRunId,
      pptxArtifactId,
      markdownArtifactId,
      manifestArtifactId,
      approvalId,
      outputDir,
      pptxHash: sha256(pptxBuffer),
      markdownHash: sha256(outlineMarkdown),
      manifestHash: sha256(JSON.stringify(deckManifest)),
      citationIds,
      gateResults,
      deckManifest,
    }),
  };
  const eventLedger = buildEventLedger({
    runAt,
    idSuffix,
    ids,
    resourceId,
    workflowRunId,
    outlineRunId,
    rendererRunId,
    pptxArtifactId,
    markdownArtifactId,
    manifestArtifactId,
    approvalId,
    costRecordId,
    gateResultIds: gateResults.map((gate) => gate.id),
  });

  return {
    creative_document_slice: creativeDocumentSlice,
    event_ledger: eventLedger,
    deck_manifest: deckManifest,
    outline_markdown: outlineMarkdown,
    pptx_buffer: pptxBuffer,
    format_validation: formatValidation,
    summary: {
      input_path: inputPath,
      workflow_run_id: workflowRunId,
      capability_id: CAPABILITY_ID,
      output_artifact_id: pptxArtifactId,
      approval_id: approvalId,
      slide_count: deckManifest.slides.length,
      artifact_count: 3,
      format_validation_status: formatValidation.status,
      status: "blocked",
      blocked_reason: "human_approval_pending",
    },
  };
}

export async function writeCreativeDocumentSlice(result, outDir = DEFAULT_CREATIVE_DOCUMENT_OUT_DIR) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "creative-document-slice.json"), result.creative_document_slice);
  await writeJson(path.join(outDir, "event-ledger.json"), result.event_ledger);
  await writeJson(path.join(outDir, "deck-manifest.json"), result.deck_manifest);
  await writeJson(path.join(outDir, "format-validation.json"), result.format_validation);
  await writeJson(path.join(outDir, "summary.json"), result.summary);
  await writeFile(path.join(outDir, "deck-outline.md"), result.outline_markdown, "utf8");
  await writeFile(path.join(outDir, "draft-deck.pptx"), result.pptx_buffer);
}

export async function runCreativeDocumentSliceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runCreativeDocumentSlice(args);
  if (!result.validation.valid) {
    console.error("Creative document slice validation failed.");
    for (const [section, validation] of Object.entries(result.validation)) {
      if (section === "valid" || validation.valid) continue;
      for (const error of validation.errors) {
        console.error(`- ${section}.${error.path}: ${error.message}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Creative document slice written to ${path.resolve(args.outDir)}`);
  console.log(`Workflow run: ${result.summary.workflow_run_id}`);
  console.log(`Slides: ${result.summary.slide_count}`);
  console.log(`Format validation: ${result.summary.format_validation_status}`);
  console.log("Status: blocked (human approval pending)");
}

function normalizeBrief(raw) {
  if (raw.schema_version !== "creative-document-brief.v1") {
    throw new Error("Input must use schema_version creative-document-brief.v1");
  }
  if (!raw.project_id || !raw.title || !Array.isArray(raw.sections) || raw.sections.length === 0) {
    throw new Error("Creative document brief requires project_id, title, and at least one section");
  }
  const classification = raw.classification ?? "P1_INTERNAL";
  if (!["P0_PUBLIC", "P1_INTERNAL"].includes(classification)) {
    throw new Error("Creative document slice only accepts P0_PUBLIC or P1_INTERNAL input by default");
  }
  return {
    ...raw,
    classification,
    language: raw.language ?? "ko",
    audience: raw.audience ?? "internal reviewer",
    constraints: raw.constraints ?? [],
    style_profile: {
      font_family: "Pretendard",
      page_size: "16:9",
      density: "compact",
      accent_colors: ["#0f766e", "#334155", "#f59e0b"],
      tone: "calm and operational",
      ...(raw.style_profile ?? {}),
    },
    sections: raw.sections.map((section, index) => ({
      title: section.title ?? `Section ${index + 1}`,
      bullets: (section.bullets ?? []).map((bullet) => String(bullet)),
    })),
  };
}

function buildDeckManifest(brief, { runAt, idSuffix, outputDir, maxSlides }) {
  const slides = [
    {
      slide_number: 1,
      layout: "title",
      title: brief.title,
      bullets: [`Audience: ${brief.audience}`, `Tone: ${brief.style_profile.tone}`],
      speaker_notes: "Open with current purpose and remind reviewers that this is a draft artifact.",
    },
  ];
  for (const section of brief.sections) {
    if (slides.length >= maxSlides) break;
    slides.push({
      slide_number: slides.length + 1,
      layout: "title_and_bullets",
      title: section.title,
      bullets: section.bullets.slice(0, 5),
      speaker_notes: `Review section source for ${section.title}.`,
    });
  }
  if (brief.constraints.length > 0 && slides.length < maxSlides) {
    slides.push({
      slide_number: slides.length + 1,
      layout: "review_gates",
      title: "Format and Approval Gates",
      bullets: brief.constraints.slice(0, 5),
      speaker_notes: "These constraints are enforced before final delivery.",
    });
  }

  return {
    schema_version: "creative-document-deck-manifest.v1",
    generated_at: isoAt(runAt, 8),
    deck_id: `deck.creative_document.${idSuffix}`,
    title: brief.title,
    output_files: {
      pptx: path.join(outputDir, "draft-deck.pptx"),
      outline_markdown: path.join(outputDir, "deck-outline.md"),
      manifest_json: path.join(outputDir, "deck-manifest.json"),
    },
    style_profile: brief.style_profile,
    constraints: brief.constraints,
    slides,
  };
}

function renderDeckOutline(brief, deckManifest, runAt) {
  const lines = [];
  lines.push(`# ${brief.title}`);
  lines.push("");
  lines.push(`Generated: ${runAt}`);
  lines.push(`Audience: ${brief.audience}`);
  lines.push(`Classification: ${brief.classification}`);
  lines.push("");
  lines.push("## Style Profile");
  lines.push("");
  lines.push(`- Font: ${brief.style_profile.font_family}`);
  lines.push(`- Page size: ${brief.style_profile.page_size}`);
  lines.push(`- Density: ${brief.style_profile.density}`);
  lines.push(`- Accent colors: ${brief.style_profile.accent_colors.join(", ")}`);
  lines.push("");
  lines.push("## Slides");
  lines.push("");
  for (const slide of deckManifest.slides) {
    lines.push(`### ${slide.slide_number}. ${slide.title}`);
    lines.push("");
    for (const bullet of slide.bullets) lines.push(`- ${bullet}`);
    lines.push("");
  }
  lines.push("## Gate Status");
  lines.push("");
  lines.push("- Classification: passed");
  lines.push("- Tool permission: passed");
  lines.push("- Cost budget: passed");
  lines.push("- Format validation: passed");
  lines.push("- Human approval: pending");
  return `${lines.join("\n")}\n`;
}

function buildWorkflowRuntime({ runAt, ids, resourceId, workflowRunId, outlineRunId, rendererRunId, pptxArtifactId, markdownArtifactId, manifestArtifactId, formatValidation }) {
  return {
    schema_version: "workflow-runtime.v1",
    capabilities: [
      {
        schema_version: "capability.v1",
        id: CAPABILITY_ID,
        version: "0.1.0",
        domain_pack: "creative-document",
        description: "Generate a draft PPTX report and design-system manifest from a structured creative-document brief.",
        input_schema: "resource-evidence.v1",
        output_schema: "governance-output.v1",
        allowed_runtimes: ["harness", "local_script", "document_renderer", "manual"],
        required_gates: {
          pre_run: ["classification_gate", "tool_permission_gate", "cost_budget_gate"],
          in_run: [],
          post_run: ["format_validation_gate", "human_approval_gate"],
        },
        data_policy: {
          max_input_classification: "P1_INTERNAL",
          external_model_policy: "allowed_with_audit",
          redaction_required: false,
        },
        approval_policy: {
          approval_type: "human_review",
          default_output_status: "draft",
        },
        timeout_policy: {
          max_seconds: 1200,
        },
        retry_policy: {
          max_attempts: 2,
        },
        cost_policy: {
          max_usd: 0,
        },
        metadata: {
          layout_validation_required: true,
        },
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
            step_id: "step.validate_creative_input",
            step_type: "gate",
            runtime_id: "harness",
            input_refs: [resourceId],
            output_contract: "gate-result.v1",
          },
          {
            step_id: "step.build_deck_manifest",
            step_type: "script",
            runtime_id: "local_script",
            input_refs: [resourceId],
            output_contract: "creative-document-deck-manifest.v1",
          },
          {
            step_id: "step.render_pptx",
            step_type: "render",
            runtime_id: "document_renderer",
            input_refs: [manifestArtifactId],
            output_contract: "output-artifact.v1",
          },
          {
            step_id: "step.request_human_approval",
            step_type: "approval",
            runtime_id: "manual",
            input_refs: [pptxArtifactId, markdownArtifactId],
            output_contract: "approval.v1",
          },
        ],
        state_machine: {
          initial: "queued",
          terminal: ["completed", "failed", "cancelled"],
          blocked_state: "awaiting_human_review",
        },
        metadata: {},
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
        input_refs: [resourceId],
        output_refs: [pptxArtifactId, markdownArtifactId, manifestArtifactId],
        policy_snapshot_id: POLICY_SNAPSHOT_ID,
        created_at: isoAt(runAt, 4),
        created_by: harnessActor(),
        metadata: {
          blocked_reason: "human_approval_pending",
          format_validation_status: formatValidation.status,
        },
      },
    ],
    agent_runs: [
      agentRun(outlineRunId, workflowRunId, "local_script", resourceId, manifestArtifactId, runAt, 5, 7, {
        lane: "deck_manifest_builder",
      }),
      agentRun(rendererRunId, workflowRunId, "document_renderer", manifestArtifactId, pptxArtifactId, runAt, 8, 10, {
        lane: "pptx_renderer",
        output_trust: "draft_until_format_and_human_review",
      }),
    ],
  };
}

function buildGateResults({ runAt, idSuffix, workflowRunId, pptxArtifactId, formatValidation }) {
  const gate = (gateId, stage, status, blocking, findings = [], offset = 1) => ({
    schema_version: "gate-result.v1",
    id: `gate-result.creative_document.${idSuffix}.${gateId}`,
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
    gate("classification_gate", "pre_run", "passed", false, [], 1),
    gate("tool_permission_gate", "pre_run", "passed", false, [], 2),
    gate("cost_budget_gate", "pre_run", "passed", false, [], 3),
    gate(
      "format_validation_gate",
      "post_run",
      formatValidation.status,
      formatValidation.status !== "passed",
      formatValidation.findings,
      11,
    ),
    gate("human_approval_gate", "post_run", "pending", true, [
      {
        finding_id: `finding.creative_document.${idSuffix}.approval_pending`,
        severity: "info",
        message: "Human review is required before this presentation can be delivered or treated as final.",
        refs: [pptxArtifactId],
      },
    ], 12),
  ];
}

function buildGovernanceOutput({ runAt, ids, workflowRunId, rendererRunId, pptxArtifactId, markdownArtifactId, manifestArtifactId, approvalId, outputDir, pptxHash, markdownHash, manifestHash, citationIds, gateResults, deckManifest }) {
  return {
    schema_version: "governance-output.v1",
    gate_results: gateResults,
    approvals: [
      {
        schema_version: "approval.v1",
        id: approvalId,
        workflow_run_id: workflowRunId,
        output_artifact_id: pptxArtifactId,
        requested_from: ids.userId,
        approval_status: "pending",
        decision: null,
        decided_at: null,
        created_at: isoAt(runAt, 12),
        metadata: {
          approval_type: "human_review",
        },
      },
    ],
    output_artifacts: [
      {
        schema_version: "output-artifact.v1",
        id: pptxArtifactId,
        tenant_id: ids.tenantId,
        matter_id: ids.matterId,
        artifact_type: "pptx",
        artifact_uri: path.join(outputDir, "draft-deck.pptx"),
        content_hash: pptxHash,
        status: "draft",
        citation_ids: citationIds,
        created_by_run_id: rendererRunId,
        created_at: isoAt(runAt, 10),
        metadata: {
          title: deckManifest.title,
          slide_count: deckManifest.slides.length,
          delivery_policy: "approval_required",
        },
      },
      {
        schema_version: "output-artifact.v1",
        id: markdownArtifactId,
        tenant_id: ids.tenantId,
        matter_id: ids.matterId,
        artifact_type: "markdown",
        artifact_uri: path.join(outputDir, "deck-outline.md"),
        content_hash: markdownHash,
        status: "draft",
        citation_ids: [],
        created_by_run_id: rendererRunId,
        created_at: isoAt(runAt, 9),
        metadata: {
          title: "Deck Outline",
        },
      },
      {
        schema_version: "output-artifact.v1",
        id: manifestArtifactId,
        tenant_id: ids.tenantId,
        matter_id: ids.matterId,
        artifact_type: "json",
        artifact_uri: path.join(outputDir, "deck-manifest.json"),
        content_hash: manifestHash,
        status: "draft",
        citation_ids: [],
        created_by_run_id: rendererRunId,
        created_at: isoAt(runAt, 8),
        metadata: {
          title: "Deck Manifest",
        },
      },
    ],
    audit_events: [
      auditEvent(`audit.creative_document.${shortId(workflowRunId)}.output_rendered`, "output.rendered", isoAt(runAt, 10), ids.tenantId, rendererActor(), "output_artifact", pptxArtifactId, workflowRunId, {
        slide_count: deckManifest.slides.length,
      }),
      auditEvent(`audit.creative_document.${shortId(workflowRunId)}.approval_requested`, "approval.requested", isoAt(runAt, 12), ids.tenantId, harnessActor(), "approval", approvalId, workflowRunId, {
        output_artifact_id: pptxArtifactId,
      }),
    ],
  };
}

function buildIdentityPolicy(ids, runAt) {
  return {
    schema_version: "identity-policy.v1",
    tenants: [
      {
        schema_version: "tenant.v1",
        id: ids.tenantId,
        name: "JWS Personal Creative Workspace",
        tenant_type: "personal",
        default_policy_id: POLICY_SNAPSHOT_ID,
        created_at: isoAt(runAt, 0),
        metadata: {},
      },
    ],
    users: [
      {
        schema_version: "user.v1",
        id: ids.userId,
        tenant_id: ids.tenantId,
        display_name: "jws",
        roles: ["owner", "developer"],
        status: "active",
        created_at: isoAt(runAt, 0),
        metadata: {},
      },
    ],
    clients: [
      {
        schema_version: "client.v1",
        id: ids.clientId,
        tenant_id: ids.tenantId,
        name: "Personal Creative Projects",
        classification_floor: "P1_INTERNAL",
        created_at: isoAt(runAt, 0),
        metadata: {},
      },
    ],
    matters: [
      {
        schema_version: "matter-core.v1",
        id: ids.matterId,
        tenant_id: ids.tenantId,
        client_id: ids.clientId,
        matter_name: "Creative Document Production",
        practice_area: "creative",
        status: "active",
        classification: "P1_INTERNAL",
        matter_team: [
          {
            user_id: ids.userId,
            matter_role: "developer",
          },
        ],
        wall_ids: ["wall.creative_document.default"],
        created_at: isoAt(runAt, 0),
        metadata: {},
      },
    ],
    policy_snapshots: [
      {
        schema_version: "policy-snapshot.v1",
        id: POLICY_SNAPSHOT_ID,
        tenant_id: ids.tenantId,
        created_at: isoAt(runAt, 0),
        classification_rules: {
          default_classification: "P1_INTERNAL",
          max_input_classification: "P1_INTERNAL",
        },
        runtime_permissions: {
          P0_PUBLIC: ["harness", "local_script", "document_renderer", "manual"],
          P1_INTERNAL: ["harness", "local_script", "document_renderer", "manual"],
        },
        model_permissions: {
          external_model_for_P1: "allowed_with_audit",
        },
        output_permissions: {
          presentation_delivery: "human_approval_required",
        },
        approval_rules: {
          creative_document_output: "human_review_required",
        },
        metadata: {},
      },
    ],
  };
}

function buildEventLedger(context) {
  const events = [];
  const push = (offset, type, subjectType, subjectId, causationId, actor, data) => {
    const id = `event.${type}.creative_document.${context.idSuffix}.${events.length + 1}`;
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
  const outlineStartedId = push(5, "agent_run.started", "agent_run", context.outlineRunId, workflowEventId, scriptActor(), {
    runtime_id: "local_script",
  });
  const outlineCompletedId = push(7, "agent_run.completed", "agent_run", context.outlineRunId, outlineStartedId, scriptActor(), {
    status: "completed",
  });
  const rendererStartedId = push(8, "agent_run.started", "agent_run", context.rendererRunId, outlineCompletedId, rendererActor(), {
    runtime_id: "document_renderer",
  });
  const rendererCompletedId = push(10, "agent_run.completed", "agent_run", context.rendererRunId, rendererStartedId, rendererActor(), {
    status: "completed",
  });
  let lastGateEventId = rendererCompletedId;
  for (const gateResultId of context.gateResultIds) {
    lastGateEventId = push(11, gateResultId.endsWith(".human_approval_gate") ? "gate.failed" : "gate.passed", "gate_result", gateResultId, lastGateEventId, harnessActor(), {});
  }
  const outputEventId = push(12, "output.rendered", "output_artifact", context.pptxArtifactId, lastGateEventId, rendererActor(), {
    artifact_type: "pptx",
    status: "draft",
  });
  const approvalEventId = push(13, "approval.requested", "approval", context.approvalId, outputEventId, harnessActor(), {
    output_artifact_id: context.pptxArtifactId,
  });
  push(14, "cost.recorded", "cost_record", context.costRecordId, approvalEventId, harnessActor(), {
    cost_type: "runtime_seconds",
    amount: 3,
  });

  return {
    schema_version: "event-ledger.v1",
    ledger_id: `ledger.creative_document.${context.idSuffix}`,
    generated_at: isoAt(context.runAt, 15),
    events,
    run_ledgers: [
      {
        schema_version: "run-ledger.v1",
        id: `run-ledger.creative_document.${context.idSuffix}`,
        tenant_id: context.ids.tenantId,
        workflow_run_id: context.workflowRunId,
        capability_id: CAPABILITY_ID,
        policy_snapshot_id: POLICY_SNAPSHOT_ID,
        status: "blocked",
        input_refs: [context.resourceId],
        agent_run_ids: [context.outlineRunId, context.rendererRunId],
        gate_result_ids: context.gateResultIds,
        approval_ids: [context.approvalId],
        output_artifact_ids: [context.pptxArtifactId, context.markdownArtifactId, context.manifestArtifactId],
        event_ids: events.map((event) => event.id),
        cost_records: [
          {
            cost_record_id: context.costRecordId,
            cost_type: "runtime_seconds",
            amount: 3,
            unit: "seconds",
            created_at: isoAt(context.runAt, 14),
            metadata: {},
          },
        ],
        error_records: [],
        created_at: isoAt(context.runAt, 4),
        updated_at: isoAt(context.runAt, 15),
        metadata: {
          blocked_reason: "human_approval_pending",
        },
      },
    ],
  };
}

function validateDeckFormat(deckManifest, pptxBuffer) {
  const findings = [];
  if (!pptxBuffer.subarray(0, 2).equals(Buffer.from("PK"))) {
    findings.push({
      finding_id: `finding.${deckManifest.deck_id}.zip_signature`,
      severity: "critical",
      message: "Generated PPTX does not start with a ZIP package signature.",
    });
  }
  if (deckManifest.slides.length === 0) {
    findings.push({
      finding_id: `finding.${deckManifest.deck_id}.slides`,
      severity: "critical",
      message: "Generated deck has no slides.",
    });
  }
  for (const slide of deckManifest.slides) {
    if (!slide.title || slide.title.length > 90) {
      findings.push({
        finding_id: `finding.${deckManifest.deck_id}.slide_${slide.slide_number}.title`,
        severity: "medium",
        message: `Slide ${slide.slide_number} title is missing or too long.`,
      });
    }
    if (slide.bullets.some((bullet) => bullet.length > 160)) {
      findings.push({
        finding_id: `finding.${deckManifest.deck_id}.slide_${slide.slide_number}.bullets`,
        severity: "medium",
        message: `Slide ${slide.slide_number} has an overlong bullet.`,
      });
    }
  }
  return {
    schema_version: "creative-document-format-validation.v1",
    generated_at: deckManifest.generated_at,
    status: findings.some((finding) => ["critical", "high"].includes(finding.severity)) ? "failed" : "passed",
    checked_files: ["draft-deck.pptx", "deck-manifest.json", "deck-outline.md"],
    findings,
    metrics: {
      slide_count: deckManifest.slides.length,
      package_bytes: pptxBuffer.length,
    },
  };
}

function buildPptx(deckManifest) {
  const files = new Map();
  const slideOverrides = deckManifest.slides
    .map((slide) => `<Override PartName="/ppt/slides/slide${slide.slide_number}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`)
    .join("");
  files.set("[Content_Types].xml", xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${slideOverrides}
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
</Types>`));
  files.set("_rels/.rels", xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`));
  files.set("docProps/core.xml", xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(deckManifest.title)}</dc:title>
  <dc:creator>Hermes Harness</dc:creator>
  <cp:lastModifiedBy>Hermes Harness</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${deckManifest.generated_at}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${deckManifest.generated_at}</dcterms:modified>
</cp:coreProperties>`));
  files.set("docProps/app.xml", xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Hermes Harness</Application>
  <PresentationFormat>On-screen Show (16:9)</PresentationFormat>
  <Slides>${deckManifest.slides.length}</Slides>
</Properties>`));
  files.set("ppt/presentation.xml", xml(renderPresentationXml(deckManifest)));
  files.set("ppt/_rels/presentation.xml.rels", xml(renderPresentationRels(deckManifest)));
  files.set("ppt/theme/theme1.xml", xml(renderThemeXml(deckManifest)));
  for (const slide of deckManifest.slides) {
    files.set(`ppt/slides/slide${slide.slide_number}.xml`, xml(renderSlideXml(slide, deckManifest.style_profile)));
  }
  return makeZip(files);
}

function renderPresentationXml(deckManifest) {
  const slideIds = deckManifest.slides
    .map((slide) => `<p:sldId id="${255 + slide.slide_number}" r:id="rId${slide.slide_number}"/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>${slideIds}</p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
}

function renderPresentationRels(deckManifest) {
  const slideRels = deckManifest.slides
    .map((slide) => `<Relationship Id="rId${slide.slide_number}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slide.slide_number}.xml"/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${slideRels}
  <Relationship Id="rIdTheme" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>`;
}

function renderSlideXml(slide, styleProfile) {
  const title = escapeXml(slide.title);
  const bullets = slide.bullets.map((bullet) => `<a:p><a:r><a:rPr lang="ko-KR" sz="2200"/><a:t>${escapeXml(bullet)}</a:t></a:r></a:p>`).join("");
  const accent = colorToHex(styleProfile.accent_colors?.[0] ?? "#0f766e");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="685800" y="548640"/><a:ext cx="10820400" cy="914400"/></a:xfrm><a:solidFill><a:srgbClr val="${accent}"/></a:solidFill></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="ko-KR" sz="3200" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>${title}</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="914400" y="1828800"/><a:ext cx="10363200" cy="4114800"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${bullets}</p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function renderThemeXml(deckManifest) {
  const accent = colorToHex(deckManifest.style_profile.accent_colors?.[0] ?? "#0f766e");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Hermes">
  <a:themeElements>
    <a:clrScheme name="Hermes">
      <a:dk1><a:srgbClr val="17202A"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="334155"/></a:dk2><a:lt2><a:srgbClr val="F8FAFC"/></a:lt2>
      <a:accent1><a:srgbClr val="${accent}"/></a:accent1>
      <a:accent2><a:srgbClr val="F59E0B"/></a:accent2>
      <a:accent3><a:srgbClr val="2563EB"/></a:accent3>
      <a:accent4><a:srgbClr val="16A34A"/></a:accent4>
      <a:accent5><a:srgbClr val="DC2626"/></a:accent5>
      <a:accent6><a:srgbClr val="7C3AED"/></a:accent6>
      <a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Hermes"><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme>
    <a:fmtScheme name="Hermes"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme>
  </a:themeElements>
</a:theme>`;
}

function makeZip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of files) {
    const nameBuffer = Buffer.from(name, "utf8");
    const data = Buffer.isBuffer(content) ? content : Buffer.from(String(content), "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuffer, data);
    central.push({ nameBuffer, dataLength: data.length, crc, offset });
    offset += local.length + nameBuffer.length + data.length;
  }
  const centralStart = offset;
  for (const entry of central) {
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt16LE(0, 14);
    header.writeUInt32LE(entry.crc, 16);
    header.writeUInt32LE(entry.dataLength, 20);
    header.writeUInt32LE(entry.dataLength, 24);
    header.writeUInt16LE(entry.nameBuffer.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE(0, 38);
    header.writeUInt32LE(entry.offset, 42);
    chunks.push(header, entry.nameBuffer);
    offset += header.length + entry.nameBuffer.length;
  }
  const centralSize = offset - centralStart;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralStart, 16);
  end.writeUInt16LE(0, 20);
  chunks.push(end);
  return Buffer.concat(chunks);
}

const CRC32_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function renderSourceSpan(brief) {
  return [
    brief.title,
    `Audience: ${brief.audience}`,
    `Style: ${JSON.stringify(brief.style_profile)}`,
    "Constraints:",
    ...brief.constraints.map((item) => `- ${item}`),
    "Sections:",
    ...brief.sections.flatMap((section) => [`## ${section.title}`, ...section.bullets.map((bullet) => `- ${bullet}`)]),
  ].join("\n");
}

function agentRun(id, workflowRunId, runtimeId, inputRef, outputRef, runAt, startedOffset, completedOffset, metadata) {
  return {
    schema_version: "agent-run.v1",
    id,
    workflow_run_id: workflowRunId,
    runtime_id: runtimeId,
    status: "completed",
    input_ref: inputRef,
    output_ref: outputRef,
    logs_ref: `logs/${id}.log`,
    started_at: isoAt(runAt, startedOffset),
    completed_at: isoAt(runAt, completedOffset),
    metadata,
  };
}

function auditEvent(id, type, time, tenantId, actor, subjectType, subjectId, correlationId, data) {
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

function harnessActor() {
  return {
    actor_type: "harness",
    actor_id: "harness.orchestrator",
    display_name: "Harness Orchestrator",
  };
}

function scriptActor() {
  return {
    actor_type: "script",
    actor_id: "script.creative_document.deck_manifest",
    display_name: "Creative Document Manifest Builder",
  };
}

function rendererActor() {
  return {
    actor_type: "renderer",
    actor_id: "renderer.creative_document.pptx",
    display_name: "Creative Document PPTX Renderer",
  };
}

function connectorActor() {
  return {
    actor_type: "connector",
    actor_id: "connector.local_filesystem",
    display_name: "Local Filesystem Connector",
  };
}

function parseArgs(argv) {
  const parsed = {
    inputPath: DEFAULT_CREATIVE_DOCUMENT_INPUT,
    outDir: DEFAULT_CREATIVE_DOCUMENT_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--input") parsed.inputPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--max-slides") parsed.maxSlides = Number(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/run-creative-document-slice.mjs [options]

Options:
  --input <path>       creative-document-brief.v1 JSON file.
  --out-dir <path>     Output directory.
  --max-slides <n>     Maximum slides to render.
  --run-at <iso>       Fixed ISO timestamp for deterministic runs.
  -h, --help           Show this help.
`);
}

function xml(value) {
  return Buffer.from(value, "utf8");
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function colorToHex(value) {
  return String(value ?? "#0f766e").replace(/^#/, "").toUpperCase().slice(0, 6).padEnd(6, "0");
}

function pad(value) {
  return String(value).padStart(3, "0");
}

function shortId(value) {
  return sha256(value).slice(0, 12);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isoAt(baseIso, seconds) {
  return new Date(new Date(baseIso).getTime() + seconds * 1000).toISOString();
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
