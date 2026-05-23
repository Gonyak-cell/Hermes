import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runControlPlaneAuditTrail } from "../src/control-plane-audit-trail.mjs";
import { runControlPlaneActionPlan } from "../src/control-plane-action-plan.mjs";
import { runControlPlaneGoalCheckpoint } from "../src/control-plane-goal-checkpoint.mjs";
import { runControlPlaneHealth } from "../src/control-plane-health.mjs";
import { runControlPlaneHumanGateReceiptApplication } from "../src/control-plane-human-gate-receipt-application.mjs";
import { runControlPlaneHumanGateReceiptValidation } from "../src/control-plane-human-gate-receipt-validation.mjs";
import { runControlPlaneHumanGateReceipts } from "../src/control-plane-human-gate-receipts.mjs";
import { runControlPlaneHumanGates } from "../src/control-plane-human-gates.mjs";
import { runHumanReviewAgenda } from "../src/human-review-agenda.mjs";
import { runHumanReviewAgendaReceiptIntake } from "../src/human-review-agenda-receipt-intake.mjs";
import { runHumanReviewContextBundle } from "../src/human-review-context-bundle.mjs";
import { runHumanReviewDecisionRegister } from "../src/human-review-decision-register.mjs";
import { runHumanReviewDecisionRegisterMerge } from "../src/human-review-decision-register-merge.mjs";
import { runHumanReviewValidationFeedback } from "../src/human-review-validation-feedback.mjs";
import { runHumanReviewReceiptWorkspace } from "../src/human-review-receipt-workspace.mjs";
import { runHumanReviewReceiptWorkspaceMerge } from "../src/human-review-receipt-workspace-merge.mjs";
import { runHumanReviewPacketLedger } from "../src/human-review-packet-ledger.mjs";
import { runControlPlaneLoop, runControlPlaneLoopFinalization } from "../src/control-plane-loop.mjs";
import { runControlPlanePipeline } from "../src/control-plane-pipeline.mjs";
import { runControlPlaneWorkPacketReceipts } from "../src/control-plane-work-packet-receipts.mjs";
import { runControlPlaneWorkPacketReceiptApplication } from "../src/control-plane-work-packet-receipt-application.mjs";
import { runControlPlaneWorkPacketReceiptValidation } from "../src/control-plane-work-packet-receipt-validation.mjs";
import { runControlPlaneWorkPackets } from "../src/control-plane-work-packets.mjs";
import { runContextPacketLedger } from "../src/context-packet-ledger.mjs";
import { runCostAttributionLedger } from "../src/cost-attribution-ledger.mjs";
import { runBudgetAlertLedger } from "../src/budget-alert-ledger.mjs";
import { runCostBudgetLedger } from "../src/cost-budget-ledger.mjs";
import { runTokenUsageLedger } from "../src/token-usage-ledger.mjs";
import { buildDealControlBrief, renderDealControlBrief } from "../src/deal-control.mjs";
import { buildDevProjectBrief, readDevProjectsFile, renderDevProjectBrief, validateDevProjects } from "../src/dev-projects.mjs";
import { extractIntakeCandidates, mergeCandidatesIntoMatter } from "../src/intake-adapter.mjs";
import { parseKakaoTalkExport } from "../src/kakao-parser.mjs";
import { buildLitigationMatrix, renderLitigationMatrix } from "../src/litigation-matrix.mjs";
import { buildMatterBrief, readMatterFile, renderMatterBrief, validateMatter } from "../src/matter-harness.mjs";
import { parseOutlookEml, parseOutlookJson } from "../src/outlook-parser.mjs";
import { runApprovalDecisions } from "../src/approval-decisions.mjs";
import { runApprovalInboxDecisions } from "../src/approval-inbox-decisions.mjs";
import { runApprovalInbox } from "../src/approval-inbox.mjs";
import { runApprovalQueue } from "../src/approval-queue.mjs";
import { runCreativeDocumentSlice } from "../src/creative-document-slice-runner.mjs";
import { runDeliveryExecutionDraft } from "../src/delivery-execution-draft.mjs";
import { runDeliveryCloseoutQueue } from "../src/delivery-closeout-queue.mjs";
import { runDeliveryCloseoutReceiptApplication } from "../src/delivery-closeout-receipt-application.mjs";
import { runDeliveryCloseoutReceiptValidation } from "../src/delivery-closeout-receipt-validation.mjs";
import { runDeliveryReceipts } from "../src/delivery-receipts.mjs";
import { runDomainPackRegistry } from "../src/domain-pack-registry.mjs";
import { runEvidenceViewer } from "../src/evidence-viewer.mjs";
import { runEvidenceReviewDraft } from "../src/evidence-review-draft.mjs";
import { runLawFirmLddSlice } from "../src/law-firm-ldd-slice-runner.mjs";
import { runMatterCockpit } from "../src/matter-cockpit.mjs";
import { runModelRoutingLedger } from "../src/model-routing-ledger.mjs";
import { runObservabilityCatalog } from "../src/observability-catalog.mjs";
import { runOutputArtifactCatalog } from "../src/output-artifact-catalog.mjs";
import { runPostDeliveryReconciliation } from "../src/post-delivery-reconciliation.mjs";
import { runProtectedDeliveryQueue } from "../src/protected-delivery-queue.mjs";
import { runPolicyMatrixCatalog } from "../src/policy-matrix-catalog.mjs";
import { runPolicySnapshotLedger } from "../src/policy-snapshot-ledger.mjs";
import { buildReviewApiResponse } from "../src/review-api.mjs";
import { runReviewDashboard } from "../src/review-dashboard.mjs";
import {
  validateCapabilityManifestFile,
  validateEventLedgerFile,
  validateEventLedger,
  validateVerticalSlice,
  loadCoreSchemas,
  validatePolicyMatrixFile,
  validateRuntimeAdapterRegistryFile,
  validateVerticalSliceFile,
  validateAgainstSchema,
} from "../src/core-contract-validator.mjs";
import { runResourceExpansionJob } from "../src/resource-expansion.mjs";
import { runResourceIngest } from "../src/resource-ingest.mjs";
import { extractResourceFile, extractTextFromOfficeXml, inferResourceSignals } from "../src/resource-extract.mjs";
import { inspectRuntimeCommandBindings, invokeRuntimeAdapter } from "../src/runtime-invoker.mjs";
import { runPersonalDevSlice } from "../src/personal-dev-slice-runner.mjs";
import { runVerticalSlice } from "../src/vertical-slice-runner.mjs";
import { prepareAgentWorkspace } from "../src/worktree-manager.mjs";

describe("matter harness", () => {
  it("validates the sample matter", async () => {
    const matter = await readMatterFile("examples/project-alpha-matter.json");
    assert.deepEqual(validateMatter(matter), []);
  });

  it("builds a useful operating brief", async () => {
    const matter = await readMatterFile("examples/project-alpha-matter.json");
    const brief = buildMatterBrief(matter, { today: "2026-05-22" });
    assert.equal(brief.open_tasks.length, 3);
    assert.equal(brief.due_soon_tasks.length, 3);
    assert.equal(brief.important_risks.length, 1);
    assert.equal(brief.pending_questions.length, 3);
  });

  it("renders the review gate", async () => {
    const matter = await readMatterFile("examples/project-alpha-matter.json");
    const brief = buildMatterBrief(matter, { today: "2026-05-22" });
    const rendered = renderMatterBrief(brief);
    assert.match(rendered, /Attorney review is required/);
    assert.match(rendered, /MNA-2026-ALPHA/);
    assert.match(rendered, /Related-party transaction issue/);
  });

  it("extracts intake candidates from raw messages", async () => {
    const matter = await readMatterFile("examples/project-alpha-matter.json");
    const messages = JSON.parse(await readFile("examples/raw-intake-messages.json", "utf8"));
    const candidates = extractIntakeCandidates(matter, messages, { today: "2026-05-22" });
    assert.equal(candidates.communications.length, 3);
    assert.equal(candidates.tasks.length, 3);
    assert.equal(candidates.deadlines.length, 3);
    assert.equal(candidates.documents.length, 2);
    assert.ok(candidates.pending_questions.length >= 2);

    const merged = mergeCandidatesIntoMatter(matter, candidates);
    assert.equal(validateMatter(merged).length, 0);
  });

  it("extracts intake candidates from KakaoTalk export", async () => {
    const matter = await readMatterFile("examples/project-alpha-matter.json");
    const text = await readFile("examples/kakaotalk-alpha-export.txt", "utf8");
    const messages = parseKakaoTalkExport(text, { matterId: matter.matter_id, sourceId: "kakao-alpha" });
    assert.equal(messages.length, 4);
    const candidates = extractIntakeCandidates(matter, messages, { today: "2026-05-22" });
    assert.ok(candidates.tasks.length >= 3);
    assert.ok(candidates.documents.length >= 2);
  });

  it("extracts intake candidates from Outlook eml and json", async () => {
    const matter = await readMatterFile("examples/project-alpha-matter.json");
    const eml = await readFile("examples/outlook-alpha-email.eml", "utf8");
    const json = await readFile("examples/outlook-alpha-messages.json", "utf8");
    const messages = [
      parseOutlookEml(eml, { matterId: matter.matter_id, sourceId: "outlook-alpha" }, "alpha.eml"),
      ...parseOutlookJson(json, { matterId: matter.matter_id, sourceId: "outlook-alpha-json" }),
    ];
    const candidates = extractIntakeCandidates(matter, messages, { today: "2026-05-22" });
    assert.equal(messages.length, 2);
    assert.ok(candidates.tasks.length >= 2);
    assert.ok(candidates.documents.length >= 1);
  });

  it("builds an M&A deal-control brief", async () => {
    const matter = await readMatterFile("examples/project-alpha-matter.json");
    const brief = buildDealControlBrief(matter, { today: "2026-05-22" });
    assert.equal(brief.missing_vdr.length, 2);
    assert.equal(brief.unanswered_qa.length, 2);
    assert.equal(brief.important_negotiation_points.length, 1);
    assert.equal(brief.blocked_cp.length, 1);
    assert.match(renderDealControlBrief(brief), /Partner approval is required/);
  });

  it("builds a litigation evidence matrix", async () => {
    const matter = await readMatterFile("examples/project-beta-litigation-matter.json");
    assert.equal(validateMatter(matter).length, 0);
    const matrix = buildLitigationMatrix(matter, { today: "2026-05-22" });
    assert.equal(matrix.unverified_facts.length, 1);
    assert.equal(matrix.unsupported_claims.length, 1);
    assert.equal(matrix.missing_evidence.length, 4);
    assert.equal(matrix.contrary_evidence.length, 1);
    assert.match(renderLitigationMatrix(matrix), /source verification/);
  });

  it("builds a personal developer project brief", async () => {
    const portfolio = await readDevProjectsFile("examples/dev-projects.json");
    assert.equal(validateDevProjects(portfolio).length, 0);
    const brief = buildDevProjectBrief(portfolio, { today: "2026-05-22" });
    assert.equal(brief.active_projects.length, 2);
    assert.ok(brief.due_today.length >= 2);
    assert.ok(brief.blocked_tasks.length >= 1);
    assert.match(renderDevProjectBrief(brief), /Recommended Focus/);
  });

  it("extracts text from office xml, Outlook EML, and classifies resource signals", async () => {
    const xml = "<w:p><w:r><w:t>LDD 전수검토</w:t></w:r></w:p><w:p><w:r><w:t>계약서 검토</w:t></w:r></w:p>";
    assert.equal(extractTextFromOfficeXml(xml), "LDD 전수검토\n계약서 검토");

    const signals = inferResourceSignals(
      {
        path: "/tmp/플러그인/05_LDD/vdr-ldd-review/skills/vdr-ldd-review/SKILL.md",
        relative_path: "플러그인/05_LDD/vdr-ldd-review/skills/vdr-ldd-review/SKILL.md",
        extension: "md",
        candidate_domain: "law-firm",
        resource_type: "skill",
      },
      "VDR 자료실 전수검토와 RFI 후보를 생성하는 Claude plugin skill",
    );

    assert.ok(signals.practice_areas.includes("ldd_vdr"));
    assert.ok(signals.resource_roles.includes("skill_instruction"));
    assert.ok(signals.capability_ids.includes("law_firm.ldd_vdr_review"));
    assert.ok(signals.capability_ids.includes("platform.plugin_skill_registry"));

    const emlPath = path.resolve("examples/outlook-alpha-email.eml");
    const emlExtraction = await extractResourceFile({
      path: emlPath,
      relative_path: "outlook-alpha-email.eml",
      size_bytes: (await readFile(emlPath)).byteLength,
      extension: "eml",
      candidate_domain: "law-firm",
      resource_type: "email",
      extractor_family: "outlook_eml",
    });
    assert.equal(emlExtraction.extraction_status, "extracted");
    assert.equal(emlExtraction.extractor, "outlook_eml_probe");
    assert.match(emlExtraction.text_preview, /Project Alpha - disclosure schedule/);
    assert.match(emlExtraction.text_preview, /tax team memo by 2026-05-24/);
    assert.ok(emlExtraction.signals.capability_ids.includes("law_firm.email_reply"));
  });

  it("runs a resumable resource expansion job with quarantine and duplicate handling", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "hermes-resource-expansion-root-"));
    const outDir = await mkdtemp(path.join(tmpdir(), "hermes-resource-expansion-out-"));
    try {
      await writeFile(path.join(root, "01-contract.md"), "# 계약 검토\n\nLDD VDR 계약서 전수검토\n", "utf8");
      await writeFile(path.join(root, "02-contract-copy.md"), "# 계약 검토\n\nLDD VDR 계약서 전수검토\n", "utf8");
      await writeFile(path.join(root, "03-token.env"), "API_TOKEN=secret\n", "utf8");

      const first = await runResourceExpansionJob({
        roots: [root],
        outDir,
        batchSize: 1,
        runAt: "2026-05-23T06:00:00.000Z",
        reset: true,
      });
      const schema = JSON.parse(await readFile("schemas/resource-expansion.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(first, schema, {}, "resource_expansion"), []);
      assert.equal(first.batch.processed_count, 1);
      assert.equal(first.summary.by_status.extracted, 1);
      assert.equal(first.summary.by_status.queued, 1);
      assert.equal(first.summary.by_status.quarantined, 1);

      const second = await runResourceExpansionJob({
        roots: [root],
        outDir,
        batchSize: 10,
        runAt: "2026-05-23T06:05:00.000Z",
      });
      assert.deepEqual(validateAgainstSchema(second, schema, {}, "resource_expansion"), []);
      assert.equal(second.resumability.loaded_previous_state, true);
      assert.equal(second.summary.by_status.extracted, 1);
      assert.equal(second.summary.by_status.skipped_duplicate, 1);
      assert.equal(second.summary.by_status.quarantined, 1);
      assert.equal(second.summary.remaining_count, 0);
      assert.match(await readFile(path.join(outDir, "quarantine-queue.json"), "utf8"), /secret_or_credential_path/);
      assert.match(await readFile(path.join(outDir, "summary.md"), "utf8"), /Resource Expansion Summary/);

      const ingest = await runResourceIngest({
        inputPath: path.join(outDir, "resource-expansion-job.json"),
        outDir: path.join(outDir, "ingest"),
        runAt: "2026-05-23T06:10:00.000Z",
      });
      const schemas = await loadCoreSchemas();
      assert.deepEqual(
        validateAgainstSchema(ingest.resource_evidence, schemas["resource-evidence.schema.json"], schemas, "resource_evidence"),
        [],
      );
      assert.equal(ingest.summary.promoted_resource_count, 1);
      assert.equal(ingest.summary.promoted_evidence_count, 1);
      assert.equal(ingest.summary.duplicate_count, 1);
      assert.equal(ingest.summary.blocked_count, 1);
      assert.equal(ingest.summary.gate_status, "blocked");
      assert.match(await readFile(path.join(outDir, "ingest", "blocked-items.json"), "utf8"), /secret_or_credential_path/);

      const viewer = await runEvidenceViewer({
        inputPath: path.join(outDir, "ingest", "resource-ingest.json"),
        outDir: path.join(outDir, "viewer"),
        runAt: "2026-05-23T06:15:00.000Z",
      });
      assert.equal(viewer.summary.evidence_count, 1);
      assert.equal(viewer.summary.needs_review_count, 1);
      assert.equal(viewer.summary.blocking_gate_count, 1);
      assert.match(viewer.html, /Hermes Evidence Viewer/);
      assert.match(viewer.html, /secret_or_credential_path/);
      assert.match(await readFile(path.join(outDir, "viewer", "summary.md"), "utf8"), /Evidence Review Queue/);

      const approvalQueue = await runApprovalQueue({
        inputPath: path.join(outDir, "viewer", "evidence-viewer.json"),
        outDir: path.join(outDir, "approval-queue"),
        runAt: "2026-05-23T06:20:00.000Z",
      });
      const approvalQueueSchema = JSON.parse(await readFile("schemas/approval-queue.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(approvalQueue, approvalQueueSchema, {}, "approval_queue"), []);
      assert.equal(approvalQueue.summary.by_type.evidence_review, 1);
      assert.equal(approvalQueue.summary.by_type.blocking_gate_review, 2);
      assert.equal(approvalQueue.summary.by_type.blocked_resource_review, 1);
      assert.equal(approvalQueue.items[0].priority, "critical");
      assert.equal(approvalQueue.decision_template.decisions.length, approvalQueue.summary.total_items);
      assert.match(await readFile(path.join(outDir, "approval-queue", "summary.md"), "utf8"), /Approval Queue/);

      const evidenceReviewDraft = await runEvidenceReviewDraft({
        queuePath: path.join(outDir, "approval-queue", "approval-queue.json"),
        outDir: path.join(outDir, "evidence-review-draft"),
        runAt: "2026-05-23T06:22:00.000Z",
      });
      const evidenceReviewDraftSchema = JSON.parse(await readFile("schemas/evidence-review-draft.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(evidenceReviewDraft, evidenceReviewDraftSchema, {}, "evidence_review_draft"), []);
      assert.equal(evidenceReviewDraft.summary.review_item_count, 1);
      assert.equal(evidenceReviewDraft.summary.pending_decision_count, approvalQueue.summary.total_items);
      assert.equal(evidenceReviewDraft.decision_draft.schema_version, "approval-decisions.v1");
      assert.match(await readFile(path.join(outDir, "evidence-review-draft", "summary.md"), "utf8"), /Evidence Review Draft/);

      const decisionsPath = path.join(outDir, "approval-decisions.json");
      const decisions = {
        ...approvalQueue.decision_template,
        decisions: approvalQueue.items.map((item) => ({
          queue_item_id: item.queue_item_id,
          decision: item.item_type === "evidence_review" ? "approved" : "waived",
          decided_by: "user.jws",
          decided_at: "2026-05-23T06:25:00.000Z",
          comment: "Test decision",
          follow_up_action: item.item_type === "evidence_review" ? "" : "waived_for_test",
        })),
      };
      await writeFile(decisionsPath, `${JSON.stringify(decisions, null, 2)}\n`, "utf8");
      const approvalResult = await runApprovalDecisions({
        queuePath: path.join(outDir, "approval-queue", "approval-queue.json"),
        decisionsPath,
        resourceEvidencePath: path.join(outDir, "ingest", "resource-evidence.json"),
        outDir: path.join(outDir, "approval-decisions"),
        runAt: "2026-05-23T06:30:00.000Z",
      });
      const approvalResultSchema = JSON.parse(await readFile("schemas/approval-decision-result.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(approvalResult, approvalResultSchema, {}, "approval_decision_result"), []);
      assert.equal(approvalResult.summary.applied_count, approvalQueue.summary.total_items);
      assert.equal(approvalResult.summary.approved_count, 1);
      assert.equal(approvalResult.summary.resolved_or_waived_count, 3);
      assert.equal(approvalResult.audit_events.length, approvalQueue.summary.total_items);
      assert.equal(approvalResult.patched_resource_evidence.evidence_items[0].review_status, "approved");
      assert.match(await readFile(path.join(outDir, "approval-decisions", "summary.md"), "utf8"), /Approval Decision Result/);

      const lddSlice = await runLawFirmLddSlice({
        inputPath: path.join(outDir, "ingest", "resource-evidence.json"),
        outDir: path.join(outDir, "law-firm-ldd"),
        runAt: "2026-05-23T06:32:00.000Z",
      });
      assert.equal(lddSlice.validation.valid, true);
      assert.equal(lddSlice.summary.status, "blocked");
      assert.equal(lddSlice.summary.blocked_reason, "attorney_approval_pending");
      assert.equal(lddSlice.summary.issue_count, 1);
      assert.equal(lddSlice.law_firm_slice.governance_output.gate_results.at(-1).gate_id, "human_approval_gate");
      assert.equal(lddSlice.law_firm_slice.governance_output.gate_results.at(-1).blocking, true);
      assert.equal(lddSlice.law_firm_slice.resource_evidence.citations.length, 1);
      assert.match(await readFile(path.join(outDir, "law-firm-ldd", "ldd-issue-report.md"), "utf8"), /LDD Issue Candidate Report/);

      const policyMatrixCatalog = await runPolicyMatrixCatalog({
        outDir: path.join(outDir, "policy-matrix"),
        runAt: "2026-05-23T06:32:30.000Z",
      });
      const policyMatrixCatalogSchema = JSON.parse(await readFile("schemas/policy-matrix-catalog.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(policyMatrixCatalog, policyMatrixCatalogSchema, {}, "policy_matrix_catalog"), []);
      assert.equal(policyMatrixCatalog.policy_status, "valid");
      assert.equal(policyMatrixCatalog.summary.classification_count, 6);
      assert.equal(policyMatrixCatalog.summary.external_model_forbidden_count, 3);
      assert.equal(policyMatrixCatalog.summary.external_model_approval_required_count, 1);
      assert.ok(policyMatrixCatalog.gate_rules.some((gate) => gate.gate_id === "human_approval_gate"));
      assert.match(await readFile(path.join(outDir, "policy-matrix", "summary.md"), "utf8"), /Policy Matrix Catalog/);

      const domainPackRegistry = await runDomainPackRegistry({
        outDir: path.join(outDir, "domain-packs"),
        runAt: "2026-05-23T06:33:00.000Z",
      });
      assert.equal(domainPackRegistry.validation.valid, true);

      const creativeDocumentSlice = await runCreativeDocumentSlice({
        outDir: path.join(outDir, "creative-document"),
        runAt: "2026-05-23T06:34:00.000Z",
      });
      assert.equal(creativeDocumentSlice.validation.valid, true);
      assert.equal(creativeDocumentSlice.summary.status, "blocked");
      assert.equal(creativeDocumentSlice.summary.format_validation_status, "passed");
      assert.equal(creativeDocumentSlice.creative_document_slice.governance_output.gate_results.at(-1).gate_id, "human_approval_gate");
      assert.equal(creativeDocumentSlice.creative_document_slice.governance_output.gate_results.at(-1).blocking, true);
      assert.equal(creativeDocumentSlice.deck_manifest.slides.length, 5);
      assert.match(await readFile(path.join(outDir, "creative-document", "deck-outline.md"), "utf8"), /Hermes Harness Progress Report/);

      const personalDevSlice = await runPersonalDevSlice({
        outDir: path.join(outDir, "personal-dev"),
        runAt: "2026-05-23T06:34:30.000Z",
        today: "2026-05-23",
        createWorktree: false,
      });
      assert.equal(personalDevSlice.validation.valid, true);

      const outputCatalog = await runOutputArtifactCatalog({
        sources: [
          {
            source_id: "law_firm_ldd_slice",
            label: "Law Firm LDD Slice",
            path: path.join(outDir, "law-firm-ldd", "law-firm-ldd-slice.json"),
          },
          {
            source_id: "personal_dev_slice",
            label: "Personal Dev Slice",
            path: path.join(outDir, "personal-dev", "personal-dev-slice.json"),
          },
          {
            source_id: "creative_document_slice",
            label: "Creative Document Slice",
            path: path.join(outDir, "creative-document", "creative-document-slice.json"),
          },
        ],
        outDir: path.join(outDir, "output-catalog"),
        runAt: "2026-05-23T06:34:45.000Z",
      });
      const outputCatalogSchema = JSON.parse(await readFile("schemas/output-artifact-catalog.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(outputCatalog, outputCatalogSchema, {}, "output_artifact_catalog"), []);
      assert.equal(outputCatalog.summary.artifact_count, 5);
      assert.equal(outputCatalog.summary.approval_pending_count, 3);
      assert.equal(outputCatalog.summary.blocked_delivery_count, 5);

      const observabilityCatalog = await runObservabilityCatalog({
        sources: [
          {
            source_id: "law_firm_ldd_slice",
            label: "Law Firm LDD Slice",
            slice_path: path.join(outDir, "law-firm-ldd", "law-firm-ldd-slice.json"),
            event_ledger_path: path.join(outDir, "law-firm-ldd", "event-ledger.json"),
          },
          {
            source_id: "personal_dev_slice",
            label: "Personal Dev Slice",
            slice_path: path.join(outDir, "personal-dev", "personal-dev-slice.json"),
            event_ledger_path: path.join(outDir, "personal-dev", "event-ledger.json"),
          },
          {
            source_id: "creative_document_slice",
            label: "Creative Document Slice",
            slice_path: path.join(outDir, "creative-document", "creative-document-slice.json"),
            event_ledger_path: path.join(outDir, "creative-document", "event-ledger.json"),
          },
        ],
        outDir: path.join(outDir, "observability"),
        runAt: "2026-05-23T06:34:50.000Z",
      });
      const observabilityCatalogSchema = JSON.parse(await readFile("schemas/observability-catalog.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(observabilityCatalog, observabilityCatalogSchema, {}, "observability_catalog"), []);
      assert.equal(observabilityCatalog.summary.workflow_run_count, 3);
      assert.equal(observabilityCatalog.summary.event_count, 41);
      assert.equal(observabilityCatalog.summary.agent_run_count, 6);
      assert.equal(observabilityCatalog.summary.total_runtime_seconds, 16);
      assert.equal(observabilityCatalog.summary.pending_approval_count, 3);
      assert.equal(observabilityCatalog.summary.blocked_run_count, 3);
      assert.equal(observabilityCatalog.summary.by_runtime_id.codex, 1);

      const policySnapshotLedger = await runPolicySnapshotLedger({
        matrixCatalogPath: path.join(outDir, "policy-matrix", "policy-matrix-catalog.json"),
        sources: [
          {
            source_id: "law_firm_ldd_slice",
            label: "Law Firm LDD Slice",
            slice_path: path.join(outDir, "law-firm-ldd", "law-firm-ldd-slice.json"),
            event_ledger_path: path.join(outDir, "law-firm-ldd", "event-ledger.json"),
          },
          {
            source_id: "personal_dev_slice",
            label: "Personal Dev Slice",
            slice_path: path.join(outDir, "personal-dev", "personal-dev-slice.json"),
            event_ledger_path: path.join(outDir, "personal-dev", "event-ledger.json"),
          },
          {
            source_id: "creative_document_slice",
            label: "Creative Document Slice",
            slice_path: path.join(outDir, "creative-document", "creative-document-slice.json"),
            event_ledger_path: path.join(outDir, "creative-document", "event-ledger.json"),
          },
        ],
        outDir: path.join(outDir, "policy-snapshots"),
        runAt: "2026-05-23T06:34:52.000Z",
      });
      const policySnapshotLedgerSchema = JSON.parse(await readFile("schemas/policy-snapshot-ledger.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(policySnapshotLedger, policySnapshotLedgerSchema, {}, "policy_snapshot_ledger"), []);
      assert.equal(policySnapshotLedger.ledger_status, "valid");
      assert.equal(policySnapshotLedger.summary.policy_snapshot_count, 3);
      assert.equal(policySnapshotLedger.summary.workflow_usage_count, 3);
      assert.equal(policySnapshotLedger.summary.event_reference_count, observabilityCatalog.summary.event_count);
      assert.equal(policySnapshotLedger.summary.runtime_violation_count, 0);
      assert.equal(policySnapshotLedger.summary.validation_error_count, 0);
      assert.ok(policySnapshotLedger.policy_snapshots.some((snapshot) => snapshot.policy_snapshot_id === "policy.default.law_firm.v1"));
      assert.match(await readFile(path.join(outDir, "policy-snapshots", "summary.md"), "utf8"), /Policy Snapshot Ledger/);

      const contextPacketLedger = await runContextPacketLedger({
        domainPackRegistryPath: path.join(outDir, "domain-packs", "domain-pack-registry.json"),
        runtimeAdaptersPath: "examples/core/runtime-adapters.json",
        policySnapshotLedgerPath: path.join(outDir, "policy-snapshots", "policy-snapshot-ledger.json"),
        sources: [
          {
            source_id: "law_firm_ldd_slice",
            label: "Law Firm LDD Slice",
            slice_path: path.join(outDir, "law-firm-ldd", "law-firm-ldd-slice.json"),
          },
          {
            source_id: "personal_dev_slice",
            label: "Personal Dev Slice",
            slice_path: path.join(outDir, "personal-dev", "personal-dev-slice.json"),
          },
          {
            source_id: "creative_document_slice",
            label: "Creative Document Slice",
            slice_path: path.join(outDir, "creative-document", "creative-document-slice.json"),
          },
        ],
        outDir: path.join(outDir, "context-packets"),
        runAt: "2026-05-23T06:34:53.000Z",
      });
      const contextPacketLedgerSchema = JSON.parse(await readFile("schemas/context-packet-ledger.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(contextPacketLedger, contextPacketLedgerSchema, {}, "context_packet_ledger"), []);
      assert.equal(contextPacketLedger.ledger_status, "valid");
      assert.equal(contextPacketLedger.summary.context_packet_count, 6);
      assert.equal(contextPacketLedger.summary.ready_packet_count, 6);
      assert.equal(contextPacketLedger.summary.blocked_packet_count, 0);
      assert.equal(contextPacketLedger.summary.redacted_packet_count, 3);
      assert.equal(contextPacketLedger.summary.validation_error_count, 0);
      assert.ok(contextPacketLedger.context_packets.some((packet) => packet.runtime_id === "codex"));
      assert.ok(contextPacketLedger.context_packets.some((packet) => packet.runtime_id === "document_renderer"));
      assert.ok(contextPacketLedger.context_items.some((item) => item.item_type === "resource_metadata"));
      assert.match(await readFile(path.join(outDir, "context-packets", "summary.md"), "utf8"), /Context Packet Ledger/);

      const modelRoutingLedger = await runModelRoutingLedger({
        contextPacketLedgerPath: path.join(outDir, "context-packets", "context-packet-ledger.json"),
        policyMatrixCatalogPath: path.join(outDir, "policy-matrix", "policy-matrix-catalog.json"),
        policySnapshotLedgerPath: path.join(outDir, "policy-snapshots", "policy-snapshot-ledger.json"),
        runtimeAdaptersPath: "examples/core/runtime-adapters.json",
        outDir: path.join(outDir, "model-routing"),
        runAt: "2026-05-23T06:34:54.000Z",
      });
      const modelRoutingLedgerSchema = JSON.parse(await readFile("schemas/model-routing-ledger.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(modelRoutingLedger, modelRoutingLedgerSchema, {}, "model_routing_ledger"), []);
      assert.equal(modelRoutingLedger.ledger_status, "valid");
      assert.equal(modelRoutingLedger.summary.routing_decision_count, contextPacketLedger.summary.context_packet_count);
      assert.equal(modelRoutingLedger.summary.blocked_route_count, 0);
      assert.equal(modelRoutingLedger.summary.external_transfer_count, 2);
      assert.equal(modelRoutingLedger.summary.ready_route_count, 6);
      assert.equal(modelRoutingLedger.summary.validation_error_count, 0);
      assert.ok(modelRoutingLedger.routing_decisions.some((decision) => (
        decision.runtime_id === "codex" && decision.route_mode === "external_allowed_with_audit"
      )));
      assert.match(await readFile(path.join(outDir, "model-routing", "summary.md"), "utf8"), /Model Routing Ledger/);

      const costBudgetLedger = await runCostBudgetLedger({
        modelRoutingLedgerPath: path.join(outDir, "model-routing", "model-routing-ledger.json"),
        domainPackRegistryPath: path.join(outDir, "domain-packs", "domain-pack-registry.json"),
        observabilityCatalogPath: path.join(outDir, "observability", "observability-catalog.json"),
        policyMatrixCatalogPath: path.join(outDir, "policy-matrix", "policy-matrix-catalog.json"),
        outDir: path.join(outDir, "cost-budget"),
        runAt: "2026-05-23T06:34:54.500Z",
      });
      const costBudgetLedgerSchema = JSON.parse(await readFile("schemas/cost-budget-ledger.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(costBudgetLedger, costBudgetLedgerSchema, {}, "cost_budget_ledger"), []);
      assert.equal(costBudgetLedger.ledger_status, "valid");
      assert.equal(costBudgetLedger.summary.budget_decision_count, modelRoutingLedger.summary.routing_decision_count);
      assert.equal(costBudgetLedger.summary.blocked_decision_count, 0);
      assert.equal(costBudgetLedger.summary.passed_decision_count, modelRoutingLedger.summary.routing_decision_count);
      assert.ok(costBudgetLedger.summary.total_max_usd > 0);
      assert.equal(costBudgetLedger.summary.validation_error_count, 0);
      assert.ok(costBudgetLedger.budget_decisions.every((decision) => decision.required_gates.includes("cost_budget_gate")));
      assert.match(await readFile(path.join(outDir, "cost-budget", "summary.md"), "utf8"), /Cost Budget Ledger/);

      const tokenUsageLedger = await runTokenUsageLedger({
        costBudgetLedgerPath: path.join(outDir, "cost-budget", "cost-budget-ledger.json"),
        contextPacketLedgerPath: path.join(outDir, "context-packets", "context-packet-ledger.json"),
        observabilityCatalogPath: path.join(outDir, "observability", "observability-catalog.json"),
        outDir: path.join(outDir, "token-usage"),
        runAt: "2026-05-23T06:34:54.750Z",
      });
      const tokenUsageLedgerSchema = JSON.parse(await readFile("schemas/token-usage-ledger.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(tokenUsageLedger, tokenUsageLedgerSchema, {}, "token_usage_ledger"), []);
      assert.equal(tokenUsageLedger.ledger_status, "valid");
      assert.equal(tokenUsageLedger.summary.token_usage_record_count, costBudgetLedger.summary.budget_decision_count);
      assert.equal(tokenUsageLedger.summary.tracking_required_count, costBudgetLedger.summary.token_tracking_required_count);
      assert.equal(tokenUsageLedger.summary.estimated_record_count, costBudgetLedger.summary.token_tracking_required_count);
      assert.ok(tokenUsageLedger.summary.total_token_count > 0);
      assert.equal(tokenUsageLedger.summary.validation_error_count, 0);
      assert.ok(tokenUsageLedger.token_usage_records.some((record) => (
        record.runtime_id === "codex" && record.tracking_status === "estimated"
      )));
      assert.match(await readFile(path.join(outDir, "token-usage", "summary.md"), "utf8"), /Token Usage Ledger/);

      const costAttributionLedger = await runCostAttributionLedger({
        costBudgetLedgerPath: path.join(outDir, "cost-budget", "cost-budget-ledger.json"),
        tokenUsageLedgerPath: path.join(outDir, "token-usage", "token-usage-ledger.json"),
        observabilityCatalogPath: path.join(outDir, "observability", "observability-catalog.json"),
        outDir: path.join(outDir, "cost-attribution"),
        runAt: "2026-05-23T06:34:54.900Z",
      });
      const costAttributionLedgerSchema = JSON.parse(await readFile("schemas/cost-attribution-ledger.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(costAttributionLedger, costAttributionLedgerSchema, {}, "cost_attribution_ledger"), []);
      assert.equal(costAttributionLedger.ledger_status, "valid");
      assert.equal(costAttributionLedger.summary.attribution_record_count, costBudgetLedger.summary.budget_decision_count);
      assert.equal(costAttributionLedger.summary.attributed_record_count, costAttributionLedger.summary.attribution_record_count);
      assert.equal(costAttributionLedger.summary.over_budget_count, 0);
      assert.equal(costAttributionLedger.summary.untracked_cost_count, 0);
      assert.ok(costAttributionLedger.summary.total_projected_usd > 0);
      assert.ok(costAttributionLedger.summary.total_budget_remaining_usd > 0);
      assert.equal(costAttributionLedger.summary.total_token_count, tokenUsageLedger.summary.total_token_count);
      assert.equal(costAttributionLedger.summary.validation_error_count, 0);
      assert.ok(costAttributionLedger.rollups.by_runtime_id.some((rollup) => rollup.key === "codex"));
      assert.match(await readFile(path.join(outDir, "cost-attribution", "summary.md"), "utf8"), /Cost Attribution Ledger/);

      const budgetAlertLedger = await runBudgetAlertLedger({
        costAttributionLedgerPath: path.join(outDir, "cost-attribution", "cost-attribution-ledger.json"),
        outDir: path.join(outDir, "budget-alerts"),
        runAt: "2026-05-23T06:34:54.950Z",
      });
      const budgetAlertLedgerSchema = JSON.parse(await readFile("schemas/budget-alert-ledger.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(budgetAlertLedger, budgetAlertLedgerSchema, {}, "budget_alert_ledger"), []);
      assert.equal(budgetAlertLedger.ledger_status, "valid");
      assert.equal(budgetAlertLedger.summary.alert_record_count, costAttributionLedger.summary.attribution_record_count);
      assert.equal(budgetAlertLedger.summary.clear_count, budgetAlertLedger.summary.alert_record_count);
      assert.equal(budgetAlertLedger.summary.active_alert_count, 0);
      assert.equal(budgetAlertLedger.summary.critical_count, 0);
      assert.equal(budgetAlertLedger.summary.validation_error_count, 0);
      assert.ok(budgetAlertLedger.alert_records.some((record) => (
        record.runtime_id === "codex" && record.alert_status === "clear"
      )));
      assert.match(await readFile(path.join(outDir, "budget-alerts", "summary.md"), "utf8"), /Budget Alert Ledger/);

      const deliveryQueue = await runProtectedDeliveryQueue({
        outputCatalogPath: path.join(outDir, "output-catalog", "output-catalog.json"),
        observabilityCatalogPath: path.join(outDir, "observability", "observability-catalog.json"),
        outDir: path.join(outDir, "delivery-queue"),
        runAt: "2026-05-23T06:34:55.000Z",
      });
      const deliveryQueueSchema = JSON.parse(await readFile("schemas/protected-delivery-queue.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(deliveryQueue, deliveryQueueSchema, {}, "protected_delivery_queue"), []);
      assert.equal(deliveryQueue.summary.delivery_action_count, 5);
      assert.equal(deliveryQueue.summary.protected_action_count, 5);
      assert.equal(deliveryQueue.summary.blocked_action_count, 5);
      assert.equal(deliveryQueue.summary.pending_approval_count, 3);
      assert.equal(deliveryQueue.summary.blocked_by_gate_count, 2);
      assert.equal(deliveryQueue.summary.ready_action_count, 0);
      assert.ok(deliveryQueue.delivery_actions.some((action) => action.delivery_channel === "github"));

      const matterCockpit = await runMatterCockpit({
        resourceEvidencePath: path.join(outDir, "ingest", "resource-evidence.json"),
        outputCatalogPath: path.join(outDir, "output-catalog", "output-catalog.json"),
        observabilityCatalogPath: path.join(outDir, "observability", "observability-catalog.json"),
        deliveryQueuePath: path.join(outDir, "delivery-queue", "protected-delivery-queue.json"),
        outDir: path.join(outDir, "matter-cockpit"),
        runAt: "2026-05-23T06:34:58.000Z",
      });
      const matterCockpitSchema = JSON.parse(await readFile("schemas/matter-cockpit.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(matterCockpit, matterCockpitSchema, {}, "matter_cockpit"), []);
      assert.equal(matterCockpit.summary.matter_count, 3);
      assert.equal(matterCockpit.summary.blocked_matter_count, 3);
      assert.equal(matterCockpit.summary.resource_count, 1);
      assert.equal(matterCockpit.summary.evidence_count, 1);
      assert.equal(matterCockpit.summary.output_artifact_count, 5);
      assert.equal(matterCockpit.summary.workflow_run_count, 3);
      assert.equal(matterCockpit.summary.delivery_action_count, 5);
      assert.equal(matterCockpit.summary.pending_approval_count, 3);
      assert.ok(matterCockpit.matters.some((matter) => matter.matter_id === "matter.personal_dev.hermes"));

      const approvalInbox = await runApprovalInbox({
        deliveryQueuePath: path.join(outDir, "delivery-queue", "protected-delivery-queue.json"),
        matterCockpitPath: path.join(outDir, "matter-cockpit", "matter-cockpit.json"),
        outDir: path.join(outDir, "approval-inbox"),
        runAt: "2026-05-23T06:34:59.000Z",
      });
      const approvalInboxSchema = JSON.parse(await readFile("schemas/approval-inbox.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(approvalInbox, approvalInboxSchema, {}, "approval_inbox"), []);
      assert.equal(approvalInbox.summary.inbox_item_count, 5);
      assert.equal(approvalInbox.summary.approval_request_count, 3);
      assert.equal(approvalInbox.summary.gate_review_count, 2);
      assert.equal(approvalInbox.summary.high_priority_count, 1);
      assert.equal(approvalInbox.decision_template.decisions.length, 5);
      assert.ok(approvalInbox.items.some((item) => item.delivery_channel === "github"));

      const approvalInboxDecisionsPath = path.join(outDir, "approval-inbox-decisions-input.json");
      const approvalInboxDecisions = {
        ...approvalInbox.decision_template,
        decisions: approvalInbox.items.map((item) => ({
          approval_item_id: item.approval_item_id,
          item_type: item.item_type,
          subject_ref: {
            subject_type: item.item_type === "approval_request" ? "approval" : "delivery_action",
            subject_id: item.approval_id ?? item.delivery_action_id,
          },
          allowed_decisions: item.allowed_decisions,
          decision: item.item_type === "approval_request" ? "approve" : "mark_resolved",
          decided_by: "user.jws",
          decided_at: "2026-05-23T06:34:59.500Z",
          comment: "Test inbox decision",
          follow_up_action: "",
        })),
      };
      await writeFile(approvalInboxDecisionsPath, `${JSON.stringify(approvalInboxDecisions, null, 2)}\n`, "utf8");
      const approvalInboxDecisionResult = await runApprovalInboxDecisions({
        inboxPath: path.join(outDir, "approval-inbox", "approval-inbox.json"),
        decisionsPath: approvalInboxDecisionsPath,
        deliveryQueuePath: path.join(outDir, "delivery-queue", "protected-delivery-queue.json"),
        outputCatalogPath: path.join(outDir, "output-catalog", "output-catalog.json"),
        outDir: path.join(outDir, "approval-inbox-decisions"),
        runAt: "2026-05-23T06:34:59.750Z",
      });
      const approvalInboxDecisionSchema = JSON.parse(await readFile("schemas/approval-inbox-decision-result.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(approvalInboxDecisionResult, approvalInboxDecisionSchema, {}, "approval_inbox_decision_result"), []);
      assert.equal(approvalInboxDecisionResult.summary.applied_count, 5);
      assert.equal(approvalInboxDecisionResult.summary.pending_count, 0);
      assert.equal(approvalInboxDecisionResult.summary.approved_count, 3);
      assert.equal(approvalInboxDecisionResult.summary.gate_resolved_or_waived_count, 2);
      assert.equal(approvalInboxDecisionResult.summary.ready_for_delivery_count, 5);
      assert.equal(approvalInboxDecisionResult.summary.patched_delivery_blocked_count, 0);
      assert.equal(approvalInboxDecisionResult.audit_events.length, 5);
      assert.deepEqual(
        validateAgainstSchema(approvalInboxDecisionResult.patched_delivery_queue, deliveryQueueSchema, {}, "patched_delivery_queue"),
        [],
      );
      assert.deepEqual(
        validateAgainstSchema(approvalInboxDecisionResult.patched_output_catalog, outputCatalogSchema, {}, "patched_output_catalog"),
        [],
      );

      const deliveryExecution = await runDeliveryExecutionDraft({
        deliveryQueuePath: path.join(outDir, "approval-inbox-decisions", "patched-delivery-queue.json"),
        outputCatalogPath: path.join(outDir, "approval-inbox-decisions", "patched-output-catalog.json"),
        outDir: path.join(outDir, "delivery-execution"),
        runAt: "2026-05-23T06:35:00.500Z",
      });
      const deliveryExecutionSchema = JSON.parse(await readFile("schemas/delivery-execution-draft.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(deliveryExecution, deliveryExecutionSchema, {}, "delivery_execution_draft"), []);
      assert.equal(deliveryExecution.execution_mode, "draft_only");
      assert.equal(deliveryExecution.summary.ready_candidate_count, 5);
      assert.equal(deliveryExecution.summary.blocked_candidate_count, 0);
      assert.equal(deliveryExecution.summary.execution_packet_count, 4);
      assert.equal(deliveryExecution.summary.manual_execution_required_count, 5);
      assert.ok(deliveryExecution.execution_candidates.every((candidate) => candidate.execution_status === "draft_not_executed"));
      assert.ok(deliveryExecution.execution_candidates.some((candidate) => candidate.delivery_channel === "github"));
      assert.ok(deliveryExecution.execution_packets.some((packet) => packet.delivery_target === "supporting_document" && packet.candidate_count === 2));

      const pendingDeliveryReceipts = await runDeliveryReceipts({
        executionDraftPath: path.join(outDir, "delivery-execution", "delivery-execution-draft.json"),
        receiptsPath: false,
        deliveryQueuePath: path.join(outDir, "approval-inbox-decisions", "patched-delivery-queue.json"),
        outputCatalogPath: path.join(outDir, "approval-inbox-decisions", "patched-output-catalog.json"),
        outDir: path.join(outDir, "delivery-receipts-pending"),
        runAt: "2026-05-23T06:35:00.750Z",
      });
      assert.equal(pendingDeliveryReceipts.summary.applied_receipt_count, 0);
      assert.equal(pendingDeliveryReceipts.summary.pending_receipt_count, 4);

      const pendingPostDeliveryReconciliation = await runPostDeliveryReconciliation({
        receiptLedgerPath: path.join(outDir, "delivery-receipts-pending", "delivery-receipt-ledger.json"),
        deliveryQueuePath: path.join(outDir, "delivery-receipts-pending", "patched-delivery-queue.json"),
        outputCatalogPath: path.join(outDir, "delivery-receipts-pending", "patched-output-catalog.json"),
        outDir: path.join(outDir, "post-delivery-reconciliation-pending"),
        runAt: "2026-05-23T06:35:00.900Z",
      });
      assert.equal(pendingPostDeliveryReconciliation.summary.outstanding_receipt_count, 4);

      const pendingCloseoutQueue = await runDeliveryCloseoutQueue({
        postDeliveryPath: path.join(outDir, "post-delivery-reconciliation-pending", "post-delivery-reconciliation.json"),
        executionDraftPath: path.join(outDir, "delivery-execution", "delivery-execution-draft.json"),
        receiptTemplatePath: path.join(outDir, "delivery-receipts-pending", "receipt-template.json"),
        outputCatalogPath: path.join(outDir, "delivery-receipts-pending", "patched-output-catalog.json"),
        outDir: path.join(outDir, "delivery-closeout-pending"),
        runAt: "2026-05-23T06:35:01.000Z",
      });
      const deliveryCloseoutSchema = JSON.parse(await readFile("schemas/delivery-closeout-queue.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(pendingCloseoutQueue, deliveryCloseoutSchema, {}, "delivery_closeout_queue"), []);
      assert.equal(pendingCloseoutQueue.summary.closeout_item_count, 4);
      assert.equal(pendingCloseoutQueue.summary.awaiting_execution_count, 4);
      assert.equal(pendingCloseoutQueue.summary.artifact_count, 5);
      assert.equal(pendingCloseoutQueue.receipt_input_draft.receipts.length, 4);
      assert.ok(pendingCloseoutQueue.closeout_items.every((item) => item.auto_execute === false));
      assert.ok(pendingCloseoutQueue.closeout_items.some((item) => item.delivery_channel === "github"));

      const closeoutReceiptValidationSchema = JSON.parse(await readFile("schemas/delivery-closeout-receipt-validation.schema.json", "utf8"));
      const pendingCloseoutReceiptValidation = await runDeliveryCloseoutReceiptValidation({
        closeoutQueuePath: path.join(outDir, "delivery-closeout-pending", "delivery-closeout-queue.json"),
        receiptInputPath: path.join(outDir, "delivery-closeout-pending", "receipt-input-draft.json"),
        outDir: path.join(outDir, "closeout-receipt-validation-pending"),
        runAt: "2026-05-23T06:35:01.100Z",
      });
      assert.deepEqual(
        validateAgainstSchema(pendingCloseoutReceiptValidation, closeoutReceiptValidationSchema, {}, "pending_closeout_receipt_validation"),
        [],
      );
      assert.equal(pendingCloseoutReceiptValidation.summary.closeout_item_count, 4);
      assert.equal(pendingCloseoutReceiptValidation.summary.pending_receipt_count, 4);
      assert.equal(pendingCloseoutReceiptValidation.summary.ready_to_apply_count, 0);
      assert.equal(pendingCloseoutReceiptValidation.summary.error_count, 0);

      const deliveryReceiptInputPath = path.join(outDir, "delivery-receipts-input.json");
      const deliveryReceiptInput = {
        ...pendingCloseoutQueue.receipt_input_draft,
        generated_at: "2026-05-23T06:35:01.250Z",
        instructions: "Test receipts",
        receipts: pendingCloseoutQueue.receipt_input_draft.receipts.map((receipt) => ({
          ...receipt,
          receipt_status: "delivered",
          executed_by: "user.jws",
          executed_at: "2026-05-23T06:35:01.500Z",
          delivery_reference: `manual://${receipt.packet_id}`,
          notes: "Test delivery receipt",
        })),
      };
      await writeFile(deliveryReceiptInputPath, `${JSON.stringify(deliveryReceiptInput, null, 2)}\n`, "utf8");
      const filledCloseoutReceiptValidation = await runDeliveryCloseoutReceiptValidation({
        closeoutQueuePath: path.join(outDir, "delivery-closeout-pending", "delivery-closeout-queue.json"),
        receiptInputPath: deliveryReceiptInputPath,
        outDir: path.join(outDir, "closeout-receipt-validation-filled"),
        runAt: "2026-05-23T06:35:01.750Z",
      });
      assert.deepEqual(
        validateAgainstSchema(filledCloseoutReceiptValidation, closeoutReceiptValidationSchema, {}, "filled_closeout_receipt_validation"),
        [],
      );
      assert.equal(filledCloseoutReceiptValidation.summary.ready_to_apply_count, 4);
      assert.equal(filledCloseoutReceiptValidation.summary.pending_receipt_count, 0);
      assert.equal(filledCloseoutReceiptValidation.summary.error_count, 0);
      assert.equal(filledCloseoutReceiptValidation.summary.fully_ready_to_apply, true);
      assert.equal(filledCloseoutReceiptValidation.validated_receipts_to_apply.receipts.length, 4);

      const closeoutReceiptApplication = await runDeliveryCloseoutReceiptApplication({
        validationPath: path.join(outDir, "closeout-receipt-validation-filled", "closeout-receipt-validation.json"),
        executionDraftPath: path.join(outDir, "delivery-execution", "delivery-execution-draft.json"),
        deliveryQueuePath: path.join(outDir, "approval-inbox-decisions", "patched-delivery-queue.json"),
        outputCatalogPath: path.join(outDir, "approval-inbox-decisions", "patched-output-catalog.json"),
        outDir: path.join(outDir, "closeout-receipt-application"),
        runAt: "2026-05-23T06:35:02.000Z",
      });
      const closeoutReceiptApplicationSchema = JSON.parse(await readFile("schemas/delivery-closeout-receipt-application.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(closeoutReceiptApplication, closeoutReceiptApplicationSchema, {}, "closeout_receipt_application"),
        [],
      );
      assert.equal(closeoutReceiptApplication.application_status, "applied");
      assert.equal(closeoutReceiptApplication.summary.ready_receipt_count, 4);
      assert.equal(closeoutReceiptApplication.summary.applied_receipt_count, 4);
      assert.equal(closeoutReceiptApplication.summary.delivered_artifact_count, 5);
      assert.equal(closeoutReceiptApplication.summary.validation_error_count, 0);

      const deliveryReceipts = closeoutReceiptApplication.delivery_receipt_ledger;
      const deliveryReceiptSchema = JSON.parse(await readFile("schemas/delivery-receipt-ledger.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(deliveryReceipts, deliveryReceiptSchema, {}, "delivery_receipt_ledger"), []);
      assert.equal(deliveryReceipts.summary.applied_receipt_count, 4);
      assert.equal(deliveryReceipts.summary.pending_receipt_count, 0);
      assert.equal(deliveryReceipts.summary.delivered_packet_count, 4);
      assert.equal(deliveryReceipts.summary.delivered_artifact_count, 5);
      assert.equal(deliveryReceipts.summary.patched_delivery_delivered_count, 5);
      assert.equal(deliveryReceipts.summary.patched_output_delivered_count, 5);
      assert.equal(deliveryReceipts.audit_events.length, 4);
      assert.deepEqual(
        validateAgainstSchema(deliveryReceipts.patched_delivery_queue, deliveryQueueSchema, {}, "receipt_patched_delivery_queue"),
        [],
      );
      assert.deepEqual(
        validateAgainstSchema(deliveryReceipts.patched_output_catalog, outputCatalogSchema, {}, "receipt_patched_output_catalog"),
        [],
      );

      const postDeliveryReconciliation = await runPostDeliveryReconciliation({
        receiptLedgerPath: path.join(outDir, "closeout-receipt-application", "delivery-receipt-ledger.json"),
        deliveryQueuePath: path.join(outDir, "closeout-receipt-application", "patched-delivery-queue.json"),
        outputCatalogPath: path.join(outDir, "closeout-receipt-application", "patched-output-catalog.json"),
        outDir: path.join(outDir, "post-delivery-reconciliation"),
        runAt: "2026-05-23T06:35:03.000Z",
      });
      const postDeliverySchema = JSON.parse(await readFile("schemas/post-delivery-reconciliation.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(postDeliveryReconciliation, postDeliverySchema, {}, "post_delivery_reconciliation"),
        [],
      );
      assert.equal(postDeliveryReconciliation.summary.delivered_artifact_count, 5);
      assert.equal(postDeliveryReconciliation.summary.applied_receipt_count, 4);
      assert.equal(postDeliveryReconciliation.summary.outstanding_receipt_count, 0);
      assert.equal(postDeliveryReconciliation.summary.delivered_matter_count, 3);
      assert.ok(postDeliveryReconciliation.reconciled_matters.every((matter) => matter.status === "delivered"));

      const finalCloseoutQueue = await runDeliveryCloseoutQueue({
        postDeliveryPath: path.join(outDir, "post-delivery-reconciliation", "post-delivery-reconciliation.json"),
        executionDraftPath: path.join(outDir, "delivery-execution", "delivery-execution-draft.json"),
        receiptTemplatePath: path.join(outDir, "closeout-receipt-application", "validated-receipts-to-apply.json"),
        outputCatalogPath: path.join(outDir, "closeout-receipt-application", "patched-output-catalog.json"),
        outDir: path.join(outDir, "delivery-closeout"),
        runAt: "2026-05-23T06:35:04.000Z",
      });
      assert.deepEqual(validateAgainstSchema(finalCloseoutQueue, deliveryCloseoutSchema, {}, "final_delivery_closeout_queue"), []);
      assert.equal(finalCloseoutQueue.summary.closeout_item_count, 0);
      assert.equal(finalCloseoutQueue.summary.awaiting_execution_count, 0);
      assert.equal(finalCloseoutQueue.receipt_input_draft.receipts.length, 0);

      const finalCloseoutReceiptValidation = await runDeliveryCloseoutReceiptValidation({
        closeoutQueuePath: path.join(outDir, "delivery-closeout", "delivery-closeout-queue.json"),
        receiptInputPath: path.join(outDir, "delivery-closeout", "receipt-input-draft.json"),
        outDir: path.join(outDir, "closeout-receipt-validation"),
        runAt: "2026-05-23T06:35:04.250Z",
      });
      assert.deepEqual(
        validateAgainstSchema(finalCloseoutReceiptValidation, closeoutReceiptValidationSchema, {}, "final_closeout_receipt_validation"),
        [],
      );
      assert.equal(finalCloseoutReceiptValidation.summary.closeout_item_count, 0);
      assert.equal(finalCloseoutReceiptValidation.summary.ready_to_apply_count, 0);
      assert.equal(finalCloseoutReceiptValidation.summary.error_count, 0);

      const controlPlanePipeline = await runControlPlanePipeline({
        outDir: path.join(outDir, "control-plane-pipeline"),
        cwd: process.cwd(),
        runAt: "2026-05-23T06:35:04.500Z",
        steps: [
          {
            step_id: "synthetic_output_catalog_check",
            label: "Synthetic Output Catalog Check",
            category: "test_control_plane",
            command: [process.execPath, "-e", "console.log('output catalog checked')"],
            expected_artifacts: [path.join(outDir, "output-catalog", "output-catalog.json")],
          },
          {
            step_id: "synthetic_dashboard_ready",
            label: "Synthetic Dashboard Ready",
            category: "test_control_plane",
            command: [process.execPath, "-e", "console.log('dashboard ready')"],
            expected_artifacts: [],
          },
        ],
      });
      const controlPlanePipelineSchema = JSON.parse(await readFile("schemas/control-plane-pipeline.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(controlPlanePipeline, controlPlanePipelineSchema, {}, "control_plane_pipeline"),
        [],
      );
      assert.equal(controlPlanePipeline.summary.overall_status, "passed");
      assert.equal(controlPlanePipeline.summary.passed_step_count, 2);

      const dashboardInputs = {
        resourceExpansionPath: path.join(outDir, "resource-expansion-job.json"),
        resourceIngestPath: path.join(outDir, "ingest", "resource-ingest.json"),
        evidenceViewerPath: path.join(outDir, "viewer", "evidence-viewer.json"),
        approvalQueuePath: path.join(outDir, "approval-queue", "approval-queue.json"),
        evidenceReviewDraftPath: path.join(outDir, "evidence-review-draft", "evidence-review-draft.json"),
        approvalDecisionPath: path.join(outDir, "approval-decisions", "approval-decision-result.json"),
        approvalInboxPath: path.join(outDir, "approval-inbox", "approval-inbox.json"),
        approvalInboxDecisionPath: path.join(outDir, "approval-inbox-decisions", "approval-inbox-decision-result.json"),
        policyMatrixCatalogPath: path.join(outDir, "policy-matrix", "policy-matrix-catalog.json"),
        policySnapshotLedgerPath: path.join(outDir, "policy-snapshots", "policy-snapshot-ledger.json"),
        contextPacketLedgerPath: path.join(outDir, "context-packets", "context-packet-ledger.json"),
        modelRoutingLedgerPath: path.join(outDir, "model-routing", "model-routing-ledger.json"),
        costBudgetLedgerPath: path.join(outDir, "cost-budget", "cost-budget-ledger.json"),
        tokenUsageLedgerPath: path.join(outDir, "token-usage", "token-usage-ledger.json"),
        costAttributionLedgerPath: path.join(outDir, "cost-attribution", "cost-attribution-ledger.json"),
        budgetAlertLedgerPath: path.join(outDir, "budget-alerts", "budget-alert-ledger.json"),
        domainPackRegistryPath: path.join(outDir, "domain-packs", "domain-pack-registry.json"),
        outputArtifactCatalogPath: path.join(outDir, "output-catalog", "output-catalog.json"),
        observabilityCatalogPath: path.join(outDir, "observability", "observability-catalog.json"),
        protectedDeliveryQueuePath: path.join(outDir, "delivery-queue", "protected-delivery-queue.json"),
        matterCockpitPath: path.join(outDir, "matter-cockpit", "matter-cockpit.json"),
        deliveryExecutionDraftPath: path.join(outDir, "delivery-execution", "delivery-execution-draft.json"),
        deliveryReceiptLedgerPath: path.join(outDir, "closeout-receipt-application", "delivery-receipt-ledger.json"),
        postDeliveryReconciliationPath: path.join(outDir, "post-delivery-reconciliation", "post-delivery-reconciliation.json"),
        deliveryCloseoutQueuePath: path.join(outDir, "delivery-closeout", "delivery-closeout-queue.json"),
        closeoutReceiptValidationPath: path.join(outDir, "closeout-receipt-validation", "closeout-receipt-validation.json"),
        closeoutReceiptApplicationPath: path.join(outDir, "closeout-receipt-application", "closeout-receipt-application.json"),
        controlPlanePipelinePath: path.join(outDir, "control-plane-pipeline", "control-plane-pipeline.json"),
        controlPlaneLoopPath: path.join(outDir, "control-plane-loop", "control-plane-loop.json"),
        controlPlaneGoalCheckpointPath: path.join(outDir, "control-plane-goal-checkpoint", "control-plane-goal-checkpoint.json"),
        controlPlaneAuditTrailPath: path.join(outDir, "control-plane-audit-trail", "control-plane-audit-trail.json"),
        controlPlaneActionPlanPath: path.join(outDir, "control-plane-action-plan", "control-plane-action-plan.json"),
        controlPlaneHumanGatesPath: path.join(outDir, "control-plane-human-gates", "control-plane-human-gates.json"),
        controlPlaneHumanGateReceiptsPath: path.join(outDir, "control-plane-human-gate-receipts", "control-plane-human-gate-receipt-drafts.json"),
        humanReviewPacketLedgerPath: path.join(outDir, "human-review-packets", "human-review-packet-ledger.json"),
        humanReviewAgendaPath: path.join(outDir, "human-review-agenda", "human-review-agenda.json"),
        humanReviewAgendaReceiptIntakePath: path.join(outDir, "human-review-agenda-receipt-intake", "human-review-agenda-receipt-intake.json"),
        humanReviewReceiptWorkspacePath: path.join(outDir, "human-review-receipt-workspace", "human-review-receipt-workspace.json"),
        humanReviewReceiptWorkspaceMergePath: path.join(outDir, "human-review-receipt-workspace-merge", "human-review-receipt-workspace-merge.json"),
        humanReviewContextBundlePath: path.join(outDir, "human-review-context-bundle", "human-review-context-bundle.json"),
        humanReviewDecisionRegisterPath: path.join(outDir, "human-review-decision-register", "human-review-decision-register.json"),
        humanReviewDecisionRegisterMergePath: path.join(outDir, "human-review-decision-register-merge", "human-review-decision-register-merge.json"),
        humanReviewValidationFeedbackPath: path.join(outDir, "human-review-validation-feedback", "human-review-validation-feedback.json"),
        controlPlaneHumanGateReceiptValidationPath: path.join(outDir, "control-plane-human-gate-receipt-validation", "control-plane-human-gate-receipt-validation.json"),
        controlPlaneHumanGateReceiptApplicationPath: path.join(outDir, "control-plane-human-gate-receipt-application", "control-plane-human-gate-receipt-application.json"),
        controlPlaneWorkPacketsPath: path.join(outDir, "control-plane-work-packets", "control-plane-work-packets.json"),
        controlPlaneWorkPacketReceiptsPath: path.join(outDir, "control-plane-work-packet-receipts", "control-plane-work-packet-receipt-drafts.json"),
        controlPlaneWorkPacketReceiptValidationPath: path.join(outDir, "control-plane-work-packet-receipt-validation", "control-plane-work-packet-receipt-validation.json"),
        controlPlaneWorkPacketReceiptApplicationPath: path.join(outDir, "control-plane-work-packet-receipt-application", "control-plane-work-packet-receipt-application.json"),
        lawFirmLddSummaryPath: path.join(outDir, "law-firm-ldd", "summary.json"),
        personalDevSummaryPath: path.join(outDir, "personal-dev", "summary.json"),
        creativeDocumentSummaryPath: path.join(outDir, "creative-document", "summary.json"),
      };
      await runReviewDashboard({
        ...dashboardInputs,
        controlPlaneHealthPath: false,
        controlPlaneLoopPath: false,
        controlPlaneGoalCheckpointPath: false,
        controlPlaneAuditTrailPath: false,
        policyMatrixCatalogPath: false,
        policySnapshotLedgerPath: false,
        controlPlaneActionPlanPath: false,
        controlPlaneHumanGatesPath: false,
        controlPlaneHumanGateReceiptsPath: false,
        humanReviewPacketLedgerPath: false,
        humanReviewAgendaPath: false,
        humanReviewAgendaReceiptIntakePath: false,
        humanReviewReceiptWorkspacePath: false,
        humanReviewReceiptWorkspaceMergePath: false,
        humanReviewContextBundlePath: false,
        humanReviewDecisionRegisterPath: false,
        humanReviewDecisionRegisterMergePath: false,
        humanReviewValidationFeedbackPath: false,
        controlPlaneHumanGateReceiptValidationPath: false,
        controlPlaneHumanGateReceiptApplicationPath: false,
        controlPlaneWorkPacketsPath: false,
        controlPlaneWorkPacketReceiptsPath: false,
        controlPlaneWorkPacketReceiptValidationPath: false,
        controlPlaneWorkPacketReceiptApplicationPath: false,
        outDir: path.join(outDir, "dashboard-pre-health"),
        runAt: "2026-05-23T06:35:00.000Z",
      });
      const controlPlaneHealth = await runControlPlaneHealth({
        dashboardPath: path.join(outDir, "dashboard-pre-health", "review-dashboard.json"),
        pipelinePath: path.join(outDir, "control-plane-pipeline", "control-plane-pipeline.json"),
        outDir: path.join(outDir, "control-plane-health"),
        runAt: "2026-05-23T06:35:04.750Z",
      });
      const controlPlaneHealthSchema = JSON.parse(await readFile("schemas/control-plane-health.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(controlPlaneHealth, controlPlaneHealthSchema, {}, "control_plane_health"),
        [],
      );
      assert.equal(controlPlaneHealth.overall_health, "blocked");
      assert.ok(controlPlaneHealth.summary.blocked_check_count >= 1);

      const controlPlaneActionPlan = await runControlPlaneActionPlan({
        dashboardPath: path.join(outDir, "dashboard-pre-health", "review-dashboard.json"),
        healthPath: path.join(outDir, "control-plane-health", "control-plane-health.json"),
        outDir: path.join(outDir, "control-plane-action-plan"),
        runAt: "2026-05-23T06:35:05.500Z",
      });
      const controlPlaneActionPlanSchema = JSON.parse(await readFile("schemas/control-plane-action-plan.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(controlPlaneActionPlan, controlPlaneActionPlanSchema, {}, "control_plane_action_plan"),
        [],
      );
      assert.equal(controlPlaneActionPlan.plan_status, "blocked");
      assert.ok(controlPlaneActionPlan.summary.plan_item_count >= controlPlaneHealth.summary.blocked_check_count);
      assert.ok(controlPlaneActionPlan.summary.human_required_count >= 1);
      assert.ok(controlPlaneActionPlan.plan_items.some((item) => item.requires_human));

      const controlPlaneHumanGates = await runControlPlaneHumanGates({
        actionPlanPath: path.join(outDir, "control-plane-action-plan", "control-plane-action-plan.json"),
        outDir: path.join(outDir, "control-plane-human-gates"),
        runAt: "2026-05-23T06:35:05.750Z",
      });
      const controlPlaneHumanGatesSchema = JSON.parse(await readFile("schemas/control-plane-human-gates.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(controlPlaneHumanGates, controlPlaneHumanGatesSchema, {}, "control_plane_human_gates"),
        [],
      );
      assert.equal(controlPlaneHumanGates.policy.auto_execute_allowed, false);
      assert.equal(controlPlaneHumanGates.summary.auto_execute_allowed_count, 0);
      assert.ok(controlPlaneHumanGates.summary.gate_item_count >= controlPlaneActionPlan.summary.human_required_count);
      assert.ok(controlPlaneHumanGates.gate_items.every((item) => item.safe_handling.auto_execute_allowed === false));
      assert.match(await readFile(path.join(outDir, "control-plane-human-gates", "summary.md"), "utf8"), /Control Plane Human Gates/);

      const controlPlaneHumanGateReceipts = await runControlPlaneHumanGateReceipts({
        humanGatesPath: path.join(outDir, "control-plane-human-gates", "control-plane-human-gates.json"),
        outDir: path.join(outDir, "control-plane-human-gate-receipts"),
        runAt: "2026-05-23T06:35:05.950Z",
      });
      const controlPlaneHumanGateReceiptsSchema = JSON.parse(await readFile("schemas/control-plane-human-gate-receipts.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(controlPlaneHumanGateReceipts, controlPlaneHumanGateReceiptsSchema, {}, "control_plane_human_gate_receipts"),
        [],
      );
      assert.equal(controlPlaneHumanGateReceipts.receipt_status, "pending_receipts");
      assert.equal(controlPlaneHumanGateReceipts.summary.receipt_draft_count, controlPlaneHumanGates.summary.gate_item_count);
      assert.equal(controlPlaneHumanGateReceipts.summary.evidence_decision_receipt_count, controlPlaneHumanGates.summary.evidence_decision_count);
      assert.ok(controlPlaneHumanGateReceipts.summary.protected_receipt_count >= controlPlaneHumanGates.summary.protected_action_count);
      assert.match(await readFile(path.join(outDir, "control-plane-human-gate-receipts", "summary.md"), "utf8"), /Control Plane Human Gate Receipt Drafts/);

      const humanReviewPacketLedger = await runHumanReviewPacketLedger({
        humanGatesPath: path.join(outDir, "control-plane-human-gates", "control-plane-human-gates.json"),
        humanGateReceiptsPath: path.join(outDir, "control-plane-human-gate-receipts", "control-plane-human-gate-receipt-drafts.json"),
        outDir: path.join(outDir, "human-review-packets"),
        runAt: "2026-05-23T06:35:06.000Z",
      });
      const humanReviewPacketLedgerSchema = JSON.parse(await readFile("schemas/human-review-packet-ledger.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewPacketLedger, humanReviewPacketLedgerSchema, {}, "human_review_packet_ledger"),
        [],
      );
      assert.equal(humanReviewPacketLedger.review_status, "pending_review");
      assert.equal(humanReviewPacketLedger.summary.review_item_count, controlPlaneHumanGates.summary.gate_item_count);
      assert.ok(humanReviewPacketLedger.summary.review_packet_count >= 1);
      assert.equal(humanReviewPacketLedger.summary.validation_error_count, 0);
      assert.ok(humanReviewPacketLedger.review_packets.some((packet) => packet.required_actor === "attorney_or_designated_reviewer"));
      assert.ok(humanReviewPacketLedger.review_items.some((item) => item.receipt_status === "pending"));
      assert.match(await readFile(path.join(outDir, "human-review-packets", "summary.md"), "utf8"), /Human Review Packet Ledger/);

      const humanReviewAgenda = await runHumanReviewAgenda({
        packetLedgerPath: path.join(outDir, "human-review-packets", "human-review-packet-ledger.json"),
        actionPlanPath: path.join(outDir, "control-plane-action-plan", "control-plane-action-plan.json"),
        outDir: path.join(outDir, "human-review-agenda"),
        runAt: "2026-05-23T06:35:06.025Z",
      });
      const humanReviewAgendaSchema = JSON.parse(await readFile("schemas/human-review-agenda.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewAgenda, humanReviewAgendaSchema, {}, "human_review_agenda"),
        [],
      );
      assert.equal(humanReviewAgenda.agenda_status, "pending_review");
      assert.equal(humanReviewAgenda.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewAgenda.summary.agenda_item_count, humanReviewPacketLedger.summary.review_packet_count);
      assert.equal(humanReviewAgenda.summary.decision_template_row_count, humanReviewPacketLedger.summary.review_item_count);
      assert.equal(humanReviewAgenda.summary.validation_error_count, 0);
      assert.ok(humanReviewAgenda.agenda_sections.some((section) => section.required_actor === "attorney_or_designated_reviewer"));
      assert.ok(humanReviewAgenda.decision_template.receipts.every((receipt) => receipt.receipt_status === "pending"));
      assert.match(await readFile(path.join(outDir, "human-review-agenda", "summary.md"), "utf8"), /Human Review Agenda/);

      const humanReviewAgendaReceiptIntake = await runHumanReviewAgendaReceiptIntake({
        agendaPath: path.join(outDir, "human-review-agenda", "human-review-agenda.json"),
        receiptDraftsPath: path.join(outDir, "control-plane-human-gate-receipts", "control-plane-human-gate-receipt-drafts.json"),
        outDir: path.join(outDir, "human-review-agenda-receipt-intake"),
        runAt: "2026-05-23T06:35:06.030Z",
      });
      const humanReviewAgendaReceiptIntakeSchema = JSON.parse(await readFile("schemas/human-review-agenda-receipt-intake.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewAgendaReceiptIntake, humanReviewAgendaReceiptIntakeSchema, {}, "human_review_agenda_receipt_intake"),
        [],
      );
      assert.equal(humanReviewAgendaReceiptIntake.intake_status, "pending_receipts");
      assert.equal(humanReviewAgendaReceiptIntake.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewAgendaReceiptIntake.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewAgendaReceiptIntake.summary.receipt_row_count, controlPlaneHumanGateReceipts.summary.receipt_draft_count);
      assert.equal(humanReviewAgendaReceiptIntake.summary.pending_receipt_count, humanReviewAgenda.summary.decision_template_row_count);
      assert.equal(humanReviewAgendaReceiptIntake.summary.validation_error_count, 0);
      assert.equal(humanReviewAgendaReceiptIntake.receipt_input.receipts.length, controlPlaneHumanGateReceipts.summary.receipt_draft_count);
      assert.match(await readFile(path.join(outDir, "human-review-agenda-receipt-intake", "summary.md"), "utf8"), /Human Review Agenda Receipt Intake/);

      const humanReviewReceiptWorkspace = await runHumanReviewReceiptWorkspace({
        intakePath: path.join(outDir, "human-review-agenda-receipt-intake", "human-review-agenda-receipt-intake.json"),
        agendaPath: path.join(outDir, "human-review-agenda", "human-review-agenda.json"),
        outDir: path.join(outDir, "human-review-receipt-workspace"),
        runAt: "2026-05-23T06:35:06.040Z",
      });
      const humanReviewReceiptWorkspaceSchema = JSON.parse(await readFile("schemas/human-review-receipt-workspace.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewReceiptWorkspace, humanReviewReceiptWorkspaceSchema, {}, "human_review_receipt_workspace"),
        [],
      );
      assert.equal(humanReviewReceiptWorkspace.workspace_status, "pending_human_review");
      assert.equal(humanReviewReceiptWorkspace.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewReceiptWorkspace.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewReceiptWorkspace.summary.actor_workspace_count, humanReviewAgenda.summary.actor_count);
      assert.equal(humanReviewReceiptWorkspace.summary.receipt_row_count, humanReviewAgendaReceiptIntake.summary.receipt_row_count);
      assert.equal(humanReviewReceiptWorkspace.summary.pending_receipt_count, humanReviewAgendaReceiptIntake.summary.pending_receipt_count);
      assert.equal(humanReviewReceiptWorkspace.summary.editable_file_count, humanReviewReceiptWorkspace.summary.actor_workspace_count * 2);
      assert.equal(humanReviewReceiptWorkspace.summary.validation_error_count, 0);
      assert.ok(humanReviewReceiptWorkspace.actor_workspaces.every((workspace) => workspace.safe_handling.auto_execute_allowed === false));
      assert.ok(humanReviewReceiptWorkspace.workspace_entries.some((entry) => entry.allowed_outcomes.length > 0));
      assert.match(await readFile(path.join(outDir, "human-review-receipt-workspace", "summary.md"), "utf8"), /Human Review Receipt Workspace/);
      assert.match(
        await readFile(path.join(outDir, "human-review-receipt-workspace", "actors", "attorney_or_designated_reviewer", "review.md"), "utf8"),
        /Human Review Receipts/,
      );

      const humanReviewReceiptWorkspaceMerge = await runHumanReviewReceiptWorkspaceMerge({
        workspacePath: path.join(outDir, "human-review-receipt-workspace", "human-review-receipt-workspace.json"),
        outDir: path.join(outDir, "human-review-receipt-workspace-merge"),
        runAt: "2026-05-23T06:35:06.045Z",
      });
      const humanReviewReceiptWorkspaceMergeSchema = JSON.parse(await readFile("schemas/human-review-receipt-workspace-merge.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewReceiptWorkspaceMerge, humanReviewReceiptWorkspaceMergeSchema, {}, "human_review_receipt_workspace_merge"),
        [],
      );
      assert.equal(humanReviewReceiptWorkspaceMerge.merge_status, "pending_receipts");
      assert.equal(humanReviewReceiptWorkspaceMerge.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewReceiptWorkspaceMerge.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewReceiptWorkspaceMerge.summary.actor_input_count, humanReviewReceiptWorkspace.summary.actor_workspace_count);
      assert.equal(humanReviewReceiptWorkspaceMerge.summary.receipt_row_count, humanReviewReceiptWorkspace.summary.receipt_row_count);
      assert.equal(humanReviewReceiptWorkspaceMerge.summary.expected_receipt_count, humanReviewReceiptWorkspace.summary.receipt_row_count);
      assert.equal(humanReviewReceiptWorkspaceMerge.summary.pending_receipt_count, humanReviewReceiptWorkspace.summary.pending_receipt_count);
      assert.equal(humanReviewReceiptWorkspaceMerge.summary.missing_receipt_count, 0);
      assert.equal(humanReviewReceiptWorkspaceMerge.summary.duplicate_receipt_count, 0);
      assert.equal(humanReviewReceiptWorkspaceMerge.summary.unknown_receipt_count, 0);
      assert.equal(humanReviewReceiptWorkspaceMerge.summary.validation_error_count, 0);
      assert.equal(humanReviewReceiptWorkspaceMerge.receipt_input.receipts.length, humanReviewReceiptWorkspace.summary.receipt_row_count);
      assert.match(await readFile(path.join(outDir, "human-review-receipt-workspace-merge", "summary.md"), "utf8"), /Human Review Receipt Workspace Merge/);

      const humanReviewContextBundle = await runHumanReviewContextBundle({
        workspaceMergePath: path.join(outDir, "human-review-receipt-workspace-merge", "human-review-receipt-workspace-merge.json"),
        workspacePath: path.join(outDir, "human-review-receipt-workspace", "human-review-receipt-workspace.json"),
        humanGatesPath: path.join(outDir, "control-plane-human-gates", "control-plane-human-gates.json"),
        actionPlanPath: path.join(outDir, "control-plane-action-plan", "control-plane-action-plan.json"),
        evidenceViewerPath: path.join(outDir, "viewer", "evidence-viewer.json"),
        approvalInboxPath: path.join(outDir, "approval-inbox", "approval-inbox.json"),
        matterCockpitPath: path.join(outDir, "matter-cockpit", "matter-cockpit.json"),
        outDir: path.join(outDir, "human-review-context-bundle"),
        runAt: "2026-05-23T06:35:06.047Z",
      });
      const humanReviewContextBundleSchema = JSON.parse(await readFile("schemas/human-review-context-bundle.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewContextBundle, humanReviewContextBundleSchema, {}, "human_review_context_bundle"),
        [],
      );
      assert.equal(humanReviewContextBundle.bundle_status, "pending_human_review");
      assert.equal(humanReviewContextBundle.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewContextBundle.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewContextBundle.summary.context_card_count, humanReviewReceiptWorkspaceMerge.summary.merge_item_count);
      assert.equal(humanReviewContextBundle.summary.actor_context_bundle_count, humanReviewReceiptWorkspace.summary.actor_workspace_count);
      assert.equal(humanReviewContextBundle.summary.pending_receipt_count, humanReviewReceiptWorkspaceMerge.summary.pending_receipt_count);
      assert.equal(humanReviewContextBundle.summary.evidence_context_count, controlPlaneHumanGates.summary.evidence_decision_count);
      assert.equal(humanReviewContextBundle.summary.validation_error_count, 0);
      assert.ok(humanReviewContextBundle.context_cards.every((card) => card.safe_handling.auto_execute_allowed === false));
      assert.ok(humanReviewContextBundle.context_cards.every((card) => card.gate_context && card.plan_context && card.review_contract));
      if (humanReviewContextBundle.summary.evidence_context_count > 0) {
        assert.ok(humanReviewContextBundle.context_cards.some((card) => card.evidence_context));
      }
      if (humanReviewContextBundle.summary.approval_context_count > 0) {
        assert.ok(humanReviewContextBundle.context_cards.some((card) => card.approval_context));
      }
      if (humanReviewContextBundle.summary.matter_context_count > 0) {
        assert.ok(humanReviewContextBundle.context_cards.some((card) => card.matter_context));
      }
      assert.match(await readFile(path.join(outDir, "human-review-context-bundle", "summary.md"), "utf8"), /Human Review Context Bundle/);
      assert.match(
        await readFile(path.join(outDir, "human-review-context-bundle", "actors", "attorney_or_designated_reviewer", "context.md"), "utf8"),
        /Human Review Context/,
      );

      const humanReviewDecisionRegister = await runHumanReviewDecisionRegister({
        contextBundlePath: path.join(outDir, "human-review-context-bundle", "human-review-context-bundle.json"),
        outDir: path.join(outDir, "human-review-decision-register"),
        runAt: "2026-05-23T06:35:06.048Z",
      });
      const humanReviewDecisionRegisterSchema = JSON.parse(await readFile("schemas/human-review-decision-register.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewDecisionRegister, humanReviewDecisionRegisterSchema, {}, "human_review_decision_register"),
        [],
      );
      assert.equal(humanReviewDecisionRegister.register_status, "pending_human_review");
      assert.equal(humanReviewDecisionRegister.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewDecisionRegister.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewDecisionRegister.summary.decision_row_count, humanReviewContextBundle.summary.context_card_count);
      assert.equal(humanReviewDecisionRegister.summary.receipt_row_count, humanReviewDecisionRegister.summary.decision_row_count);
      assert.equal(humanReviewDecisionRegister.summary.actor_decision_register_count, humanReviewContextBundle.summary.actor_context_bundle_count);
      assert.equal(humanReviewDecisionRegister.summary.pending_decision_count, humanReviewContextBundle.summary.pending_receipt_count);
      assert.equal(humanReviewDecisionRegister.summary.evidence_decision_count, humanReviewContextBundle.summary.by_gate_type.evidence_decision ?? 0);
      assert.equal(humanReviewDecisionRegister.summary.validation_error_count, 0);
      assert.equal(humanReviewDecisionRegister.receipt_input.receipts.length, humanReviewDecisionRegister.summary.decision_row_count);
      assert.ok(humanReviewDecisionRegister.decision_rows.every((row) => row.safe_handling.auto_execute_allowed === false));
      assert.ok(humanReviewDecisionRegister.decision_rows.every((row) => row.context_card_id && row.receipt && row.allowed_outcomes.length > 0));
      assert.match(await readFile(path.join(outDir, "human-review-decision-register", "summary.md"), "utf8"), /Human Review Decision Register/);
      assert.match(
        await readFile(path.join(outDir, "human-review-decision-register", "actors", "attorney_or_designated_reviewer", "review.md"), "utf8"),
        /Human Review Decisions/,
      );

      const humanReviewDecisionRegisterMerge = await runHumanReviewDecisionRegisterMerge({
        registerPath: path.join(outDir, "human-review-decision-register", "human-review-decision-register.json"),
        outDir: path.join(outDir, "human-review-decision-register-merge"),
        runAt: "2026-05-23T06:35:06.049Z",
      });
      const humanReviewDecisionRegisterMergeSchema = JSON.parse(await readFile("schemas/human-review-decision-register-merge.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewDecisionRegisterMerge, humanReviewDecisionRegisterMergeSchema, {}, "human_review_decision_register_merge"),
        [],
      );
      assert.equal(humanReviewDecisionRegisterMerge.merge_status, "pending_receipts");
      assert.equal(humanReviewDecisionRegisterMerge.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewDecisionRegisterMerge.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewDecisionRegisterMerge.summary.actor_input_count, humanReviewDecisionRegister.summary.actor_decision_register_count);
      assert.equal(humanReviewDecisionRegisterMerge.summary.receipt_row_count, humanReviewDecisionRegister.summary.receipt_row_count);
      assert.equal(humanReviewDecisionRegisterMerge.summary.expected_receipt_count, humanReviewDecisionRegister.summary.decision_row_count);
      assert.equal(humanReviewDecisionRegisterMerge.summary.pending_receipt_count, humanReviewDecisionRegister.summary.pending_decision_count);
      assert.equal(humanReviewDecisionRegisterMerge.summary.missing_receipt_count, 0);
      assert.equal(humanReviewDecisionRegisterMerge.summary.duplicate_receipt_count, 0);
      assert.equal(humanReviewDecisionRegisterMerge.summary.unknown_receipt_count, 0);
      assert.equal(humanReviewDecisionRegisterMerge.summary.invalid_decision_receipt_count, 0);
      assert.equal(humanReviewDecisionRegisterMerge.summary.validation_error_count, 0);
      assert.equal(humanReviewDecisionRegisterMerge.receipt_input.receipts.length, humanReviewDecisionRegister.summary.receipt_row_count);
      assert.ok(humanReviewDecisionRegisterMerge.merge_items.every((item) => item.safe_handling.auto_execute_allowed === false));
      assert.match(await readFile(path.join(outDir, "human-review-decision-register-merge", "summary.md"), "utf8"), /Human Review Decision Register Merge/);

      const controlPlaneHumanGateReceiptValidation = await runControlPlaneHumanGateReceiptValidation({
        receiptDraftsPath: path.join(outDir, "control-plane-human-gate-receipts", "control-plane-human-gate-receipt-drafts.json"),
        receiptInputPath: path.join(outDir, "human-review-decision-register-merge", "receipt-input.json"),
        outDir: path.join(outDir, "control-plane-human-gate-receipt-validation"),
        runAt: "2026-05-23T06:35:06.050Z",
      });
      const controlPlaneHumanGateReceiptValidationSchema = JSON.parse(await readFile("schemas/control-plane-human-gate-receipt-validation.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(controlPlaneHumanGateReceiptValidation, controlPlaneHumanGateReceiptValidationSchema, {}, "control_plane_human_gate_receipt_validation"),
        [],
      );
      assert.equal(controlPlaneHumanGateReceiptValidation.validation_status, "pending_receipts");
      assert.equal(controlPlaneHumanGateReceiptValidation.summary.pending_receipt_count, controlPlaneHumanGateReceipts.summary.receipt_draft_count);
      assert.equal(controlPlaneHumanGateReceiptValidation.summary.ready_to_apply_count, 0);
      assert.equal(controlPlaneHumanGateReceiptValidation.summary.error_count, 0);
      assert.match(await readFile(path.join(outDir, "control-plane-human-gate-receipt-validation", "summary.md"), "utf8"), /Control Plane Human Gate Receipt Validation/);

      const humanReviewValidationFeedback = await runHumanReviewValidationFeedback({
        mergePath: path.join(outDir, "human-review-decision-register-merge", "human-review-decision-register-merge.json"),
        validationPath: path.join(outDir, "control-plane-human-gate-receipt-validation", "control-plane-human-gate-receipt-validation.json"),
        outDir: path.join(outDir, "human-review-validation-feedback"),
        runAt: "2026-05-23T06:35:06.075Z",
      });
      const humanReviewValidationFeedbackSchema = JSON.parse(await readFile("schemas/human-review-validation-feedback.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewValidationFeedback, humanReviewValidationFeedbackSchema, {}, "human_review_validation_feedback"),
        [],
      );
      assert.equal(humanReviewValidationFeedback.feedback_status, "pending_human_review");
      assert.equal(humanReviewValidationFeedback.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewValidationFeedback.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewValidationFeedback.summary.actor_feedback_count, humanReviewDecisionRegisterMerge.summary.actor_input_count);
      assert.equal(humanReviewValidationFeedback.summary.feedback_item_count, controlPlaneHumanGateReceiptValidation.summary.validation_item_count);
      assert.equal(humanReviewValidationFeedback.summary.pending_receipt_count, controlPlaneHumanGateReceiptValidation.summary.pending_receipt_count);
      assert.equal(humanReviewValidationFeedback.summary.ready_for_application_count, 0);
      assert.equal(humanReviewValidationFeedback.summary.needs_correction_count, 0);
      assert.equal(humanReviewValidationFeedback.summary.missing_validation_count, 0);
      assert.equal(humanReviewValidationFeedback.summary.validation_error_count, 0);
      assert.ok(humanReviewValidationFeedback.feedback_items.every((item) => item.safe_handling.auto_execute_allowed === false));
      assert.ok(humanReviewValidationFeedback.feedback_items.every((item) => item.next_actions.length > 0));
      assert.match(await readFile(path.join(outDir, "human-review-validation-feedback", "summary.md"), "utf8"), /Human Review Validation Feedback/);
      assert.match(
        await readFile(path.join(outDir, "human-review-validation-feedback", "actors", "attorney_or_designated_reviewer", "feedback.md"), "utf8"),
        /Human Review Validation Feedback/,
      );

      const controlPlaneHumanGateReceiptApplication = await runControlPlaneHumanGateReceiptApplication({
        validationPath: path.join(outDir, "control-plane-human-gate-receipt-validation", "control-plane-human-gate-receipt-validation.json"),
        humanGatesPath: path.join(outDir, "control-plane-human-gates", "control-plane-human-gates.json"),
        outDir: path.join(outDir, "control-plane-human-gate-receipt-application"),
        runAt: "2026-05-23T06:35:06.150Z",
      });
      const controlPlaneHumanGateReceiptApplicationSchema = JSON.parse(await readFile("schemas/control-plane-human-gate-receipt-application.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(controlPlaneHumanGateReceiptApplication, controlPlaneHumanGateReceiptApplicationSchema, {}, "control_plane_human_gate_receipt_application"),
        [],
      );
      assert.equal(controlPlaneHumanGateReceiptApplication.application_status, "nothing_to_apply");
      assert.equal(controlPlaneHumanGateReceiptApplication.protected_actions_executed, false);
      assert.equal(controlPlaneHumanGateReceiptApplication.summary.applied_receipt_count, 0);
      assert.equal(controlPlaneHumanGateReceiptApplication.summary.pending_receipt_count, controlPlaneHumanGateReceiptValidation.summary.pending_receipt_count);
      assert.equal(controlPlaneHumanGateReceiptApplication.applied_receipts.length, 0);
      assert.match(await readFile(path.join(outDir, "control-plane-human-gate-receipt-application", "summary.md"), "utf8"), /Control Plane Human Gate Receipt Application/);

      const controlPlaneWorkPackets = await runControlPlaneWorkPackets({
        actionPlanPath: path.join(outDir, "control-plane-action-plan", "control-plane-action-plan.json"),
        outDir: path.join(outDir, "control-plane-work-packets"),
        runAt: "2026-05-23T06:35:06.250Z",
      });
      const controlPlaneWorkPacketsSchema = JSON.parse(await readFile("schemas/control-plane-work-packets.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(controlPlaneWorkPackets, controlPlaneWorkPacketsSchema, {}, "control_plane_work_packets"),
        [],
      );
      assert.equal(controlPlaneWorkPackets.packet_status, "blocked");
      assert.ok(controlPlaneWorkPackets.summary.work_packet_count >= 1);
      assert.ok(controlPlaneWorkPackets.summary.work_item_count >= controlPlaneActionPlan.summary.plan_item_count);
      assert.ok(controlPlaneWorkPackets.summary.human_packet_count >= 1);

      const controlPlaneWorkPacketReceipts = await runControlPlaneWorkPacketReceipts({
        workPacketsPath: path.join(outDir, "control-plane-work-packets", "control-plane-work-packets.json"),
        outDir: path.join(outDir, "control-plane-work-packet-receipts"),
        runAt: "2026-05-23T06:35:06.850Z",
      });
      const controlPlaneWorkPacketReceiptsSchema = JSON.parse(await readFile("schemas/control-plane-work-packet-receipt-drafts.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(controlPlaneWorkPacketReceipts, controlPlaneWorkPacketReceiptsSchema, {}, "control_plane_work_packet_receipts"),
        [],
      );
      assert.equal(controlPlaneWorkPacketReceipts.receipt_status, "pending_receipts");
      assert.equal(controlPlaneWorkPacketReceipts.summary.receipt_draft_count, controlPlaneWorkPackets.summary.work_packet_count);
      assert.ok(controlPlaneWorkPacketReceipts.summary.human_receipt_count >= 1);

      const controlPlaneWorkPacketReceiptValidation = await runControlPlaneWorkPacketReceiptValidation({
        receiptDraftsPath: path.join(outDir, "control-plane-work-packet-receipts", "control-plane-work-packet-receipt-drafts.json"),
        receiptInputPath: path.join(outDir, "control-plane-work-packet-receipts", "receipt-input-draft.json"),
        outDir: path.join(outDir, "control-plane-work-packet-receipt-validation"),
        runAt: "2026-05-23T06:35:07.200Z",
      });
      const controlPlaneWorkPacketReceiptValidationSchema = JSON.parse(await readFile("schemas/control-plane-work-packet-receipt-validation.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(controlPlaneWorkPacketReceiptValidation, controlPlaneWorkPacketReceiptValidationSchema, {}, "control_plane_work_packet_receipt_validation"),
        [],
      );
      assert.equal(controlPlaneWorkPacketReceiptValidation.validation_status, "pending_receipts");
      assert.equal(controlPlaneWorkPacketReceiptValidation.summary.pending_receipt_count, controlPlaneWorkPacketReceipts.summary.receipt_draft_count);
      assert.equal(controlPlaneWorkPacketReceiptValidation.summary.ready_to_apply_count, 0);

      const controlPlaneWorkPacketReceiptApplication = await runControlPlaneWorkPacketReceiptApplication({
        validationPath: path.join(outDir, "control-plane-work-packet-receipt-validation", "control-plane-work-packet-receipt-validation.json"),
        workPacketsPath: path.join(outDir, "control-plane-work-packets", "control-plane-work-packets.json"),
        outDir: path.join(outDir, "control-plane-work-packet-receipt-application"),
        runAt: "2026-05-23T06:35:07.550Z",
      });
      const controlPlaneWorkPacketReceiptApplicationSchema = JSON.parse(await readFile("schemas/control-plane-work-packet-receipt-application.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(controlPlaneWorkPacketReceiptApplication, controlPlaneWorkPacketReceiptApplicationSchema, {}, "control_plane_work_packet_receipt_application"),
        [],
      );
      assert.equal(controlPlaneWorkPacketReceiptApplication.application_status, "nothing_to_apply");
      assert.equal(controlPlaneWorkPacketReceiptApplication.summary.applied_receipt_count, 0);
      assert.equal(controlPlaneWorkPacketReceiptApplication.summary.pending_receipt_count, controlPlaneWorkPacketReceiptValidation.summary.pending_receipt_count);
      assert.equal(controlPlaneWorkPacketReceiptApplication.applied_receipts.length, 0);

      const controlPlaneAuditTrail = await runControlPlaneAuditTrail({
        approvalDecisionPath: path.join(outDir, "approval-decisions", "approval-decision-result.json"),
        approvalInboxDecisionPath: path.join(outDir, "approval-inbox-decisions", "approval-inbox-decision-result.json"),
        deliveryReceiptLedgerPath: false,
        closeoutReceiptApplicationPath: path.join(outDir, "closeout-receipt-application", "closeout-receipt-application.json"),
        humanGateReceiptApplicationPath: path.join(outDir, "control-plane-human-gate-receipt-application", "control-plane-human-gate-receipt-application.json"),
        workPacketReceiptApplicationPath: path.join(outDir, "control-plane-work-packet-receipt-application", "control-plane-work-packet-receipt-application.json"),
        outDir: path.join(outDir, "control-plane-audit-trail"),
        runAt: "2026-05-23T06:35:07.700Z",
      });
      const controlPlaneAuditTrailSchema = JSON.parse(await readFile("schemas/control-plane-audit-trail.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(controlPlaneAuditTrail, controlPlaneAuditTrailSchema, {}, "control_plane_audit_trail"),
        [],
      );
      assert.equal(controlPlaneAuditTrail.audit_status, "complete");
      assert.equal(
        controlPlaneAuditTrail.summary.audit_event_count,
        approvalResult.audit_events.length + approvalInboxDecisionResult.audit_events.length + closeoutReceiptApplication.audit_events.length,
      );
      assert.equal(controlPlaneAuditTrail.summary.by_event_type["approval.decided"], approvalResult.audit_events.length);
      assert.equal(controlPlaneAuditTrail.summary.by_event_type["approval_inbox.decided"], approvalInboxDecisionResult.audit_events.length);
      assert.equal(controlPlaneAuditTrail.summary.by_event_type["delivery.executed"], closeoutReceiptApplication.audit_events.length);
      assert.equal(controlPlaneAuditTrail.summary.protected_action_executed_count, closeoutReceiptApplication.audit_events.length);
      assert.match(await readFile(path.join(outDir, "control-plane-audit-trail", "summary.md"), "utf8"), /Control Plane Audit Trail/);

      const controlPlaneLoop = await runControlPlaneLoop({
        outDir: path.join(outDir, "control-plane-loop"),
        runAt: "2026-05-23T06:35:07.900Z",
        steps: [
          {
            step_id: "synthetic_work_packet_application_seen",
            label: "Synthetic Work Packet Application Seen",
            category: "test_control_plane_loop",
            command: [process.execPath, "-e", "console.log('work packet application seen')"],
            expected_artifacts: [path.join(outDir, "control-plane-work-packet-receipt-application", "control-plane-work-packet-receipt-application.json")],
          },
        ],
      });
      const controlPlaneLoopSchema = JSON.parse(await readFile("schemas/control-plane-loop.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(controlPlaneLoop, controlPlaneLoopSchema, {}, "control_plane_loop"), []);
      assert.equal(controlPlaneLoop.loop_status, "passed");
      assert.equal(controlPlaneLoop.summary.passed_step_count, 1);

      const controlPlaneLoopFinalization = await runControlPlaneLoopFinalization({
        outDir: path.join(outDir, "control-plane-loop"),
        runAt: "2026-05-23T06:35:07.950Z",
        steps: [
          {
            step_id: "synthetic_loop_artifact_refresh",
            label: "Synthetic Loop Artifact Refresh",
            category: "test_control_plane_loop_finalization",
            command: [process.execPath, "-e", "console.log('loop artifact refresh seen')"],
            expected_artifacts: [path.join(outDir, "control-plane-loop", "control-plane-loop.json")],
          },
        ],
      });
      const controlPlaneLoopFinalizationSchema = JSON.parse(await readFile("schemas/control-plane-loop-finalization.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(controlPlaneLoopFinalization, controlPlaneLoopFinalizationSchema, {}, "control_plane_loop_finalization"),
        [],
      );
      assert.equal(controlPlaneLoopFinalization.finalization_status, "passed");
      assert.equal(controlPlaneLoopFinalization.summary.passed_step_count, 1);
      assert.match(await readFile(path.join(outDir, "control-plane-loop", "finalization-summary.md"), "utf8"), /Control Plane Loop Finalization/);

      await runReviewDashboard({
        ...dashboardInputs,
        controlPlaneHealthPath: path.join(outDir, "control-plane-health", "control-plane-health.json"),
        controlPlaneLoopPath: path.join(outDir, "control-plane-loop", "control-plane-loop.json"),
        controlPlaneGoalCheckpointPath: false,
        controlPlaneActionPlanPath: path.join(outDir, "control-plane-action-plan", "control-plane-action-plan.json"),
        controlPlaneHumanGatesPath: path.join(outDir, "control-plane-human-gates", "control-plane-human-gates.json"),
        controlPlaneWorkPacketsPath: path.join(outDir, "control-plane-work-packets", "control-plane-work-packets.json"),
        controlPlaneWorkPacketReceiptsPath: path.join(outDir, "control-plane-work-packet-receipts", "control-plane-work-packet-receipt-drafts.json"),
        controlPlaneWorkPacketReceiptValidationPath: path.join(outDir, "control-plane-work-packet-receipt-validation", "control-plane-work-packet-receipt-validation.json"),
        controlPlaneWorkPacketReceiptApplicationPath: path.join(outDir, "control-plane-work-packet-receipt-application", "control-plane-work-packet-receipt-application.json"),
        outDir: path.join(outDir, "dashboard-pre-checkpoint"),
        runAt: "2026-05-23T06:35:08.000Z",
      });

      const controlPlaneGoalCheckpoint = await runControlPlaneGoalCheckpoint({
        dashboardPath: path.join(outDir, "dashboard-pre-checkpoint", "review-dashboard.json"),
        loopPath: path.join(outDir, "control-plane-loop", "control-plane-loop.json"),
        healthPath: path.join(outDir, "control-plane-health", "control-plane-health.json"),
        packagePath: "package.json",
        roadmapPath: "docs/implementation-roadmap.md",
        outDir: path.join(outDir, "control-plane-goal-checkpoint"),
        runAt: "2026-05-23T06:35:08.250Z",
      });
      const controlPlaneGoalCheckpointSchema = JSON.parse(await readFile("schemas/control-plane-goal-checkpoint.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(controlPlaneGoalCheckpoint, controlPlaneGoalCheckpointSchema, {}, "control_plane_goal_checkpoint"),
        [],
      );
      assert.ok(["passed", "attention", "blocked", "incomplete"].includes(controlPlaneGoalCheckpoint.checkpoint_status));
      assert.ok(controlPlaneGoalCheckpoint.summary.checkpoint_item_count >= 13);
      assert.ok(controlPlaneGoalCheckpoint.summary.passed_item_count >= 1);
      assert.ok(controlPlaneGoalCheckpoint.summary.implementation_gate_pass_count >= 1);
      assert.ok(controlPlaneGoalCheckpoint.checkpoint_items.some((item) => item.checkpoint_item_id === "control-plane-loop"));
      const evidenceViewerCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-evidence-viewer");
      assert.equal(evidenceViewerCheckpoint?.acceptance_profile, "evidence_review_gate");
      assert.ok(["passed", "passed_with_operational_gate", "blocked", "attention"].includes(evidenceViewerCheckpoint?.implementation_status));
      const contextBundleCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-context-bundle");
      assert.equal(contextBundleCheckpoint?.acceptance_profile, "human_review_context_bundle_gate");
      assert.equal(contextBundleCheckpoint?.implementation_status, "passed_with_operational_gate");
      const decisionRegisterCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-decision-register");
      assert.equal(decisionRegisterCheckpoint?.acceptance_profile, "human_review_decision_register_gate");
      assert.equal(decisionRegisterCheckpoint?.implementation_status, "passed_with_operational_gate");
      const decisionRegisterMergeCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-decision-register-merge");
      assert.equal(decisionRegisterMergeCheckpoint?.acceptance_profile, "human_review_decision_register_merge_gate");
      assert.equal(decisionRegisterMergeCheckpoint?.implementation_status, "passed_with_operational_gate");
      const validationFeedbackCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-validation-feedback");
      assert.equal(validationFeedbackCheckpoint?.acceptance_profile, "human_review_validation_feedback_gate");
      assert.equal(validationFeedbackCheckpoint?.implementation_status, "passed_with_operational_gate");
      assert.ok(controlPlaneGoalCheckpoint.checkpoint_items.some((item) => item.implementation_status === "passed_with_operational_gate"));
      assert.match(await readFile(path.join(outDir, "control-plane-goal-checkpoint", "summary.md"), "utf8"), /Control Plane Goal Checkpoint/);

      const dashboard = await runReviewDashboard({
        ...dashboardInputs,
        controlPlaneHealthPath: path.join(outDir, "control-plane-health", "control-plane-health.json"),
        controlPlaneLoopPath: path.join(outDir, "control-plane-loop", "control-plane-loop.json"),
        controlPlaneGoalCheckpointPath: path.join(outDir, "control-plane-goal-checkpoint", "control-plane-goal-checkpoint.json"),
        controlPlaneActionPlanPath: path.join(outDir, "control-plane-action-plan", "control-plane-action-plan.json"),
        controlPlaneHumanGatesPath: path.join(outDir, "control-plane-human-gates", "control-plane-human-gates.json"),
        controlPlaneWorkPacketsPath: path.join(outDir, "control-plane-work-packets", "control-plane-work-packets.json"),
        controlPlaneWorkPacketReceiptsPath: path.join(outDir, "control-plane-work-packet-receipts", "control-plane-work-packet-receipt-drafts.json"),
        controlPlaneWorkPacketReceiptValidationPath: path.join(outDir, "control-plane-work-packet-receipt-validation", "control-plane-work-packet-receipt-validation.json"),
        controlPlaneWorkPacketReceiptApplicationPath: path.join(outDir, "control-plane-work-packet-receipt-application", "control-plane-work-packet-receipt-application.json"),
        outDir: path.join(outDir, "dashboard"),
        runAt: "2026-05-23T06:35:00.000Z",
      });
      const dashboardSchema = JSON.parse(await readFile("schemas/review-dashboard.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(dashboard, dashboardSchema, {}, "review_dashboard"), []);
      assert.equal(dashboard.summary.overall_status, "blocked");
      assert.equal(dashboard.summary.evidence_approved_count, 1);
      assert.equal(dashboard.summary.evidence_review_draft_item_count, evidenceReviewDraft.summary.review_item_count);
      assert.equal(dashboard.summary.evidence_review_draft_attorney_count, evidenceReviewDraft.summary.attorney_review_count);
      assert.equal(dashboard.summary.evidence_review_draft_pending_decision_count, evidenceReviewDraft.summary.pending_decision_count);
      assert.equal(dashboard.summary.pending_approval_count, 3);
      assert.equal(dashboard.summary.policy_classification_count, policyMatrixCatalog.summary.classification_count);
      assert.equal(dashboard.summary.policy_gate_rule_count, policyMatrixCatalog.summary.gate_rule_count);
      assert.equal(dashboard.summary.policy_external_model_forbidden_count, policyMatrixCatalog.summary.external_model_forbidden_count);
      assert.equal(dashboard.summary.policy_validation_error_count, 0);
      assert.equal(dashboard.summary.policy_snapshot_count, policySnapshotLedger.summary.policy_snapshot_count);
      assert.equal(dashboard.summary.policy_snapshot_workflow_usage_count, policySnapshotLedger.summary.workflow_usage_count);
      assert.equal(dashboard.summary.policy_snapshot_event_reference_count, policySnapshotLedger.summary.event_reference_count);
      assert.equal(dashboard.summary.policy_snapshot_validation_error_count, 0);
      assert.equal(dashboard.summary.context_packet_count, contextPacketLedger.summary.context_packet_count);
      assert.equal(dashboard.summary.context_packet_ready_count, contextPacketLedger.summary.ready_packet_count);
      assert.equal(dashboard.summary.context_packet_redacted_count, contextPacketLedger.summary.redacted_packet_count);
      assert.equal(dashboard.summary.context_item_count, contextPacketLedger.summary.context_item_count);
      assert.equal(dashboard.summary.context_retrieval_filter_count, contextPacketLedger.summary.retrieval_filter_count);
      assert.equal(dashboard.summary.model_route_count, modelRoutingLedger.summary.routing_decision_count);
      assert.equal(dashboard.summary.model_route_ready_count, modelRoutingLedger.summary.ready_route_count);
      assert.equal(dashboard.summary.model_route_external_transfer_count, modelRoutingLedger.summary.external_transfer_count);
      assert.equal(dashboard.summary.model_route_validation_error_count, 0);
      assert.equal(dashboard.summary.cost_budget_decision_count, costBudgetLedger.summary.budget_decision_count);
      assert.equal(dashboard.summary.cost_budget_passed_count, costBudgetLedger.summary.passed_decision_count);
      assert.equal(dashboard.summary.cost_budget_blocked_count, 0);
      assert.equal(dashboard.summary.cost_budget_total_max_usd, costBudgetLedger.summary.total_max_usd);
      assert.equal(dashboard.summary.cost_budget_validation_error_count, 0);
      assert.equal(dashboard.summary.token_usage_record_count, tokenUsageLedger.summary.token_usage_record_count);
      assert.equal(dashboard.summary.token_usage_tracking_required_count, tokenUsageLedger.summary.tracking_required_count);
      assert.equal(dashboard.summary.token_usage_estimated_count, tokenUsageLedger.summary.estimated_record_count);
      assert.equal(dashboard.summary.token_usage_total_tokens, tokenUsageLedger.summary.total_token_count);
      assert.equal(dashboard.summary.token_usage_validation_error_count, 0);
      assert.equal(dashboard.summary.cost_attribution_record_count, costAttributionLedger.summary.attribution_record_count);
      assert.equal(dashboard.summary.cost_attribution_attributed_count, costAttributionLedger.summary.attributed_record_count);
      assert.equal(dashboard.summary.cost_attribution_over_budget_count, 0);
      assert.equal(dashboard.summary.cost_attribution_total_projected_usd, costAttributionLedger.summary.total_projected_usd);
      assert.equal(dashboard.summary.cost_attribution_total_remaining_usd, costAttributionLedger.summary.total_budget_remaining_usd);
      assert.equal(dashboard.summary.cost_attribution_validation_error_count, 0);
      assert.equal(dashboard.summary.budget_alert_record_count, budgetAlertLedger.summary.alert_record_count);
      assert.equal(dashboard.summary.budget_alert_clear_count, budgetAlertLedger.summary.clear_count);
      assert.equal(dashboard.summary.budget_alert_active_count, 0);
      assert.equal(dashboard.summary.budget_alert_validation_error_count, 0);
      assert.equal(dashboard.summary.context_validation_error_count, 0);
      assert.equal(dashboard.summary.domain_pack_count, 4);
      assert.equal(dashboard.summary.domain_pack_capability_count, 4);
      assert.equal(dashboard.summary.domain_pack_error_count, 0);
      assert.equal(dashboard.summary.output_artifact_count, 5);
      assert.equal(dashboard.summary.output_artifact_pending_approval_count, 3);
      assert.equal(dashboard.summary.output_artifact_blocked_delivery_count, 5);
      assert.equal(dashboard.summary.observability_run_count, 3);
      assert.equal(dashboard.summary.observability_event_count, 41);
      assert.equal(dashboard.summary.observability_runtime_seconds, 16);
      assert.equal(dashboard.summary.observability_error_count, 0);
      assert.equal(dashboard.summary.delivery_action_count, 5);
      assert.equal(dashboard.summary.delivery_blocked_action_count, 5);
      assert.equal(dashboard.summary.delivery_ready_action_count, 0);
      assert.equal(dashboard.summary.delivery_pending_approval_count, 3);
      assert.equal(dashboard.summary.delivery_execution_ready_candidate_count, 5);
      assert.equal(dashboard.summary.delivery_execution_packet_count, 4);
      assert.equal(dashboard.summary.delivery_execution_manual_required_count, 5);
      assert.equal(dashboard.summary.delivery_execution_blocked_candidate_count, 0);
      assert.equal(dashboard.summary.delivery_receipt_applied_count, 4);
      assert.equal(dashboard.summary.delivery_receipt_pending_count, 0);
      assert.equal(dashboard.summary.delivery_receipt_delivered_artifact_count, 5);
      assert.equal(dashboard.summary.delivery_receipt_error_count, 0);
      assert.equal(dashboard.summary.post_delivery_delivered_artifact_count, 5);
      assert.equal(dashboard.summary.post_delivery_delivered_matter_count, 3);
      assert.equal(dashboard.summary.post_delivery_outstanding_receipt_count, 0);
      assert.equal(dashboard.summary.delivery_closeout_item_count, 0);
      assert.equal(dashboard.summary.delivery_closeout_awaiting_count, 0);
      assert.equal(dashboard.summary.delivery_closeout_blocked_count, 0);
      assert.equal(dashboard.summary.closeout_receipt_ready_count, 0);
      assert.equal(dashboard.summary.closeout_receipt_pending_count, 0);
      assert.equal(dashboard.summary.closeout_receipt_invalid_count, 0);
      assert.equal(dashboard.summary.closeout_receipt_error_count, 0);
      assert.equal(dashboard.summary.closeout_application_ready_count, 4);
      assert.equal(dashboard.summary.closeout_application_applied_count, 4);
      assert.equal(dashboard.summary.closeout_application_delivered_artifact_count, 5);
      assert.equal(dashboard.summary.closeout_application_error_count, 0);
      assert.equal(dashboard.summary.pipeline_step_count, 2);
      assert.equal(dashboard.summary.pipeline_passed_step_count, 2);
      assert.equal(dashboard.summary.pipeline_failed_step_count, 0);
      assert.equal(dashboard.summary.pipeline_missing_artifact_count, 0);
      assert.equal(dashboard.summary.control_plane_loop_step_count, 1);
      assert.equal(dashboard.summary.control_plane_loop_passed_step_count, 1);
      assert.equal(dashboard.summary.control_plane_loop_failed_step_count, 0);
      assert.equal(dashboard.summary.audit_trail_source_count, controlPlaneAuditTrail.summary.source_count);
      assert.equal(dashboard.summary.audit_trail_missing_source_count, 0);
      assert.equal(dashboard.summary.audit_trail_event_count, controlPlaneAuditTrail.summary.audit_event_count);
      assert.equal(dashboard.summary.audit_trail_protected_action_executed_count, closeoutReceiptApplication.audit_events.length);
      assert.equal(dashboard.summary.audit_event_count, controlPlaneAuditTrail.summary.audit_event_count);
      assert.equal(dashboard.summary.goal_checkpoint_item_count, controlPlaneGoalCheckpoint.summary.checkpoint_item_count);
      assert.equal(dashboard.summary.goal_checkpoint_passed_item_count, controlPlaneGoalCheckpoint.summary.passed_item_count);
      assert.equal(dashboard.summary.goal_checkpoint_attention_item_count, controlPlaneGoalCheckpoint.summary.attention_item_count);
      assert.equal(dashboard.summary.goal_checkpoint_blocked_item_count, controlPlaneGoalCheckpoint.summary.blocked_item_count);
      assert.equal(dashboard.summary.goal_checkpoint_missing_item_count, controlPlaneGoalCheckpoint.summary.missing_item_count);
      assert.equal(dashboard.summary.health_check_count, 8);
      assert.ok(dashboard.summary.health_passed_check_count >= 1);
      assert.ok(dashboard.summary.health_blocked_check_count >= 1);
      assert.ok(dashboard.summary.health_attention_check_count >= 1);
      assert.equal(dashboard.summary.action_plan_item_count, controlPlaneActionPlan.summary.plan_item_count);
      assert.ok(dashboard.summary.action_plan_human_required_count >= 1);
      assert.equal(dashboard.summary.human_gate_item_count, controlPlaneHumanGates.summary.gate_item_count);
      assert.equal(dashboard.summary.human_gate_evidence_decision_count, controlPlaneHumanGates.summary.evidence_decision_count);
      assert.equal(dashboard.summary.human_gate_auto_execute_allowed_count, 0);
      assert.equal(dashboard.summary.human_gate_receipt_draft_count, controlPlaneHumanGateReceipts.summary.receipt_draft_count);
      assert.equal(dashboard.summary.human_gate_receipt_evidence_decision_count, controlPlaneHumanGateReceipts.summary.evidence_decision_receipt_count);
      assert.ok(dashboard.summary.human_gate_receipt_human_count >= 1);
      assert.ok(dashboard.summary.human_gate_receipt_protected_count >= controlPlaneHumanGates.summary.protected_action_count);
      assert.equal(dashboard.summary.human_review_packet_count, humanReviewPacketLedger.summary.review_packet_count);
      assert.equal(dashboard.summary.human_review_item_count, humanReviewPacketLedger.summary.review_item_count);
      assert.equal(dashboard.summary.human_review_pending_packet_count, humanReviewPacketLedger.summary.pending_packet_count);
      assert.equal(dashboard.summary.human_review_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_agenda_item_count, humanReviewAgenda.summary.agenda_item_count);
      assert.equal(dashboard.summary.human_review_agenda_actor_count, humanReviewAgenda.summary.actor_count);
      assert.equal(dashboard.summary.human_review_agenda_decision_row_count, humanReviewAgenda.summary.decision_template_row_count);
      assert.equal(dashboard.summary.human_review_agenda_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_agenda_intake_receipt_row_count, humanReviewAgendaReceiptIntake.summary.receipt_row_count);
      assert.equal(dashboard.summary.human_review_agenda_intake_pending_count, humanReviewAgendaReceiptIntake.summary.pending_receipt_count);
      assert.equal(dashboard.summary.human_review_agenda_intake_ready_count, 0);
      assert.equal(dashboard.summary.human_review_agenda_intake_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_receipt_workspace_actor_count, humanReviewReceiptWorkspace.summary.actor_workspace_count);
      assert.equal(dashboard.summary.human_review_receipt_workspace_entry_count, humanReviewReceiptWorkspace.summary.workspace_entry_count);
      assert.equal(dashboard.summary.human_review_receipt_workspace_receipt_row_count, humanReviewReceiptWorkspace.summary.receipt_row_count);
      assert.equal(dashboard.summary.human_review_receipt_workspace_pending_count, humanReviewReceiptWorkspace.summary.pending_receipt_count);
      assert.equal(dashboard.summary.human_review_receipt_workspace_editable_file_count, humanReviewReceiptWorkspace.summary.editable_file_count);
      assert.equal(dashboard.summary.human_review_receipt_workspace_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_receipt_workspace_merge_actor_input_count, humanReviewReceiptWorkspaceMerge.summary.actor_input_count);
      assert.equal(dashboard.summary.human_review_receipt_workspace_merge_receipt_row_count, humanReviewReceiptWorkspaceMerge.summary.receipt_row_count);
      assert.equal(dashboard.summary.human_review_receipt_workspace_merge_pending_count, humanReviewReceiptWorkspaceMerge.summary.pending_receipt_count);
      assert.equal(dashboard.summary.human_review_receipt_workspace_merge_ready_count, 0);
      assert.equal(dashboard.summary.human_review_receipt_workspace_merge_missing_count, 0);
      assert.equal(dashboard.summary.human_review_receipt_workspace_merge_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_context_bundle_actor_count, humanReviewContextBundle.summary.actor_context_bundle_count);
      assert.equal(dashboard.summary.human_review_context_bundle_card_count, humanReviewContextBundle.summary.context_card_count);
      assert.equal(dashboard.summary.human_review_context_bundle_pending_count, humanReviewContextBundle.summary.pending_receipt_count);
      assert.equal(dashboard.summary.human_review_context_bundle_evidence_count, humanReviewContextBundle.summary.evidence_context_count);
      assert.equal(dashboard.summary.human_review_context_bundle_approval_count, humanReviewContextBundle.summary.approval_context_count);
      assert.equal(dashboard.summary.human_review_context_bundle_matter_count, humanReviewContextBundle.summary.matter_context_count);
      assert.equal(dashboard.summary.human_review_context_bundle_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_decision_register_actor_count, humanReviewDecisionRegister.summary.actor_decision_register_count);
      assert.equal(dashboard.summary.human_review_decision_register_row_count, humanReviewDecisionRegister.summary.decision_row_count);
      assert.equal(dashboard.summary.human_review_decision_register_receipt_row_count, humanReviewDecisionRegister.summary.receipt_row_count);
      assert.equal(dashboard.summary.human_review_decision_register_pending_count, humanReviewDecisionRegister.summary.pending_decision_count);
      assert.equal(dashboard.summary.human_review_decision_register_ready_count, 0);
      assert.equal(dashboard.summary.human_review_decision_register_invalid_count, 0);
      assert.equal(dashboard.summary.human_review_decision_register_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_decision_register_merge_actor_input_count, humanReviewDecisionRegisterMerge.summary.actor_input_count);
      assert.equal(dashboard.summary.human_review_decision_register_merge_receipt_row_count, humanReviewDecisionRegisterMerge.summary.receipt_row_count);
      assert.equal(dashboard.summary.human_review_decision_register_merge_pending_count, humanReviewDecisionRegisterMerge.summary.pending_receipt_count);
      assert.equal(dashboard.summary.human_review_decision_register_merge_ready_count, 0);
      assert.equal(dashboard.summary.human_review_decision_register_merge_missing_count, 0);
      assert.equal(dashboard.summary.human_review_decision_register_merge_invalid_count, 0);
      assert.equal(dashboard.summary.human_review_decision_register_merge_validation_error_count, 0);
      assert.equal(dashboard.summary.human_gate_receipt_validation_pending_count, controlPlaneHumanGateReceiptValidation.summary.pending_receipt_count);
      assert.equal(dashboard.summary.human_gate_receipt_validation_ready_count, 0);
      assert.equal(dashboard.summary.human_gate_receipt_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_validation_feedback_actor_count, humanReviewValidationFeedback.summary.actor_feedback_count);
      assert.equal(dashboard.summary.human_review_validation_feedback_item_count, humanReviewValidationFeedback.summary.feedback_item_count);
      assert.equal(dashboard.summary.human_review_validation_feedback_pending_count, humanReviewValidationFeedback.summary.pending_receipt_count);
      assert.equal(dashboard.summary.human_review_validation_feedback_ready_count, 0);
      assert.equal(dashboard.summary.human_review_validation_feedback_correction_count, 0);
      assert.equal(dashboard.summary.human_review_validation_feedback_missing_validation_count, 0);
      assert.equal(dashboard.summary.human_review_validation_feedback_validation_error_count, 0);
      assert.equal(dashboard.summary.human_gate_receipt_application_ready_count, 0);
      assert.equal(dashboard.summary.human_gate_receipt_application_applied_count, 0);
      assert.equal(dashboard.summary.human_gate_receipt_application_patched_gate_count, 0);
      assert.equal(dashboard.summary.human_gate_receipt_application_error_count, 0);
      assert.equal(dashboard.summary.human_gate_receipt_application_protected_count, 0);
      assert.equal(dashboard.summary.human_gate_receipt_application_evidence_decision_count, 0);
      assert.equal(dashboard.summary.work_packet_count, controlPlaneWorkPackets.summary.work_packet_count);
      assert.ok(dashboard.summary.work_packet_human_count >= 1);
      assert.equal(dashboard.summary.work_packet_receipt_draft_count, controlPlaneWorkPacketReceipts.summary.receipt_draft_count);
      assert.ok(dashboard.summary.work_packet_receipt_human_count >= 1);
      assert.equal(dashboard.summary.work_packet_receipt_validation_pending_count, controlPlaneWorkPacketReceiptValidation.summary.pending_receipt_count);
      assert.equal(dashboard.summary.work_packet_receipt_validation_ready_count, 0);
      assert.equal(dashboard.summary.work_packet_receipt_application_ready_count, 0);
      assert.equal(dashboard.summary.work_packet_receipt_application_applied_count, 0);
      assert.equal(dashboard.summary.work_packet_receipt_application_patched_packet_count, 0);
      assert.equal(dashboard.summary.matter_count, 3);
      assert.equal(dashboard.summary.blocked_matter_count, 3);
      assert.equal(dashboard.summary.pending_review_matter_count, 0);
      assert.equal(dashboard.summary.ready_matter_count, 0);
      assert.equal(dashboard.summary.approval_inbox_item_count, 5);
      assert.equal(dashboard.summary.approval_inbox_request_count, 3);
      assert.equal(dashboard.summary.approval_inbox_gate_review_count, 2);
      assert.equal(dashboard.summary.approval_inbox_high_priority_count, 1);
      assert.equal(dashboard.summary.approval_inbox_applied_count, 5);
      assert.equal(dashboard.summary.approval_inbox_decision_pending_count, 0);
      assert.equal(dashboard.summary.approval_inbox_ready_for_delivery_count, 5);
      assert.equal(dashboard.summary.approval_inbox_decision_error_count, 0);
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "policy_matrix_catalog"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "policy_snapshot_ledger"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "context_packet_ledger"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "model_routing_ledger"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "cost_budget_ledger"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "token_usage_ledger"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "cost_attribution_ledger"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "budget_alert_ledger"));
      assert.equal(dashboard.summary.law_firm_issue_count, 1);
      assert.equal(dashboard.summary.law_firm_citation_count, 1);
      assert.equal(dashboard.summary.creative_slide_count, 5);
      assert.equal(dashboard.summary.creative_artifact_count, 3);
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "domain_pack_registry"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "output_artifact_catalog"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "observability_catalog"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "protected_delivery_queue"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "matter_cockpit"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "delivery_execution_draft"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "delivery_receipt_ledger"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "post_delivery_reconciliation"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "delivery_closeout_queue"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "closeout_receipt_validation"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "closeout_receipt_application"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "control_plane_pipeline"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "control_plane_loop"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "control_plane_goal_checkpoint"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "control_plane_audit_trail"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "control_plane_health"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "control_plane_action_plan"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "control_plane_human_gates"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "control_plane_human_gate_receipts"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_packet_ledger"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_agenda"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_agenda_receipt_intake"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_receipt_workspace"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_receipt_workspace_merge"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_context_bundle"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_decision_register"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_decision_register_merge"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "control_plane_human_gate_receipt_validation"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_validation_feedback"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "control_plane_human_gate_receipt_application"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "control_plane_work_packets"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "control_plane_work_packet_receipts"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "control_plane_work_packet_receipt_validation"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "control_plane_work_packet_receipt_application"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "approval_inbox"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "approval_inbox_decisions"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "evidence_review_draft"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "law_firm_ldd_slice"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "creative_document_slice"));
      assert.ok(dashboard.action_items.some((item) => item.source_stage === "law_firm_ldd_slice"));
      assert.ok(dashboard.action_items.some((item) => item.source_stage === "creative_document_slice"));
      assert.ok(dashboard.summary.action_item_count >= 1);
      assert.match(await readFile(path.join(outDir, "dashboard", "index.html"), "utf8"), /Hermes Review Dashboard/);
      assert.match(await readFile(path.join(outDir, "dashboard", "summary.md"), "utf8"), /Action Items/);

      const apiOptions = {
        dashboardPath: path.join(outDir, "dashboard", "review-dashboard.json"),
        indexPath: path.join(outDir, "dashboard", "index.html"),
        summaryPath: path.join(outDir, "dashboard", "summary.md"),
        runAt: "2026-05-23T06:40:00.000Z",
      };
      const routeIndexResponse = await buildReviewApiResponse("/api", apiOptions);
      assert.equal(routeIndexResponse.status, 200);
      const routeIndex = JSON.parse(routeIndexResponse.body);
      const routeIndexSchema = JSON.parse(await readFile("schemas/review-api-index.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(routeIndex, routeIndexSchema, {}, "review_api_index"), []);
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/actions"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/evidence-review-drafts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/evidence-review-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/policy-matrices"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/policy-classifications"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/runtime-policies"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/model-policies"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/tool-policies"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/output-policies"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/gate-policies"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/policy-snapshot-ledgers"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/policy-snapshots"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/policy-snapshot-instances"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/policy-decisions"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/policy-usages"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/context-packet-ledgers"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/context-packets"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/context-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/context-retrieval-filters"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/model-routing-ledgers"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/model-routing-decisions"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/cost-budget-ledgers"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/cost-budget-decisions"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/token-usage-ledgers"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/token-usage-records"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/cost-attribution-ledgers"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/cost-attribution-records"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/budget-alert-ledgers"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/budget-alert-records"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/packs"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/capabilities"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/artifacts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/runs"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/events"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/costs"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/audit-trails"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/audit-events"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/audit-sources"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/delivery-actions"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/matters"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/approvals"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/approval-inbox-decisions"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/delivery-execution-candidates"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/delivery-execution-packets"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/delivery-receipts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/delivery-receipt-events"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/post-delivery-matters"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/delivered-artifacts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/outstanding-receipts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/delivery-closeout-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/receipt-input-drafts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/closeout-receipt-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/closeout-receipt-errors"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/validated-receipts-to-apply"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/closeout-receipt-applications"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/closeout-applied-receipts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/pipeline-runs"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/pipeline-steps"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/control-plane-loops"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/control-plane-loop-steps"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/goal-checkpoints"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/goal-checkpoint-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/control-plane-health"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/health-checks"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/action-plans"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/action-plan-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-gates"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-gate-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-gate-receipts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-gate-receipt-requirements"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-gate-receipt-drafts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-packet-ledgers"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-packets"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-agendas"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-agenda-sections"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-agenda-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-decision-template"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-agenda-receipt-intakes"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-agenda-receipt-intake-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-agenda-receipt-input"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-receipt-workspaces"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-actor-workspaces"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-workspace-entries"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-receipt-workspace-merges"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-receipt-merge-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-merged-receipt-input"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-context-bundles"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-context-cards"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-actor-context-bundles"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-decision-registers"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-decision-rows"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-decision-receipt-input"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-decision-register-merges"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-decision-merge-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-merged-decision-receipt-input"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-gate-receipt-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-gate-receipt-errors"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-validation-feedbacks"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-feedback-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-actor-feedback"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/validated-human-gate-receipts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-gate-receipt-applications"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/applied-human-gate-receipts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/patched-human-gate-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/action-work-packets"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/action-work-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/work-packet-receipt-requirements"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/work-packet-receipt-drafts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/work-packet-receipt-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/work-packet-receipt-errors"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/validated-work-packet-receipts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/work-packet-receipt-applications"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/applied-work-packet-receipts"));

      const apiDashboard = JSON.parse((await buildReviewApiResponse("/api/dashboard", apiOptions)).body);
      assert.equal(apiDashboard.schema_version, "review-dashboard.v1");
      assert.equal(apiDashboard.summary.overall_status, "blocked");

      const highActions = JSON.parse((await buildReviewApiResponse("/api/actions?priority=high", apiOptions)).body);
      assert.equal(highActions.collection, "action_items");
      assert.ok(highActions.items.length >= 1);
      assert.ok(highActions.items.every((item) => item.priority === "high"));

      const evidenceReviewDrafts = JSON.parse((await buildReviewApiResponse("/api/evidence-review-drafts", apiOptions)).body);
      assert.equal(evidenceReviewDrafts.collection, "evidence_review_drafts");
      assert.equal(evidenceReviewDrafts.count, 1);

      const evidenceReviewItems = JSON.parse((await buildReviewApiResponse("/api/evidence-review-items?review_status=ready_for_review", apiOptions)).body);
      assert.equal(evidenceReviewItems.collection, "evidence_review_items");
      assert.ok(evidenceReviewItems.count >= 1);

      const policyMatrices = JSON.parse((await buildReviewApiResponse("/api/policy-matrices?policy_status=valid", apiOptions)).body);
      assert.equal(policyMatrices.collection, "policy_matrices");
      assert.equal(policyMatrices.count, 1);

      const p3ModelPolicies = JSON.parse((await buildReviewApiResponse("/api/model-policies?classification=P3_PRIVILEGED", apiOptions)).body);
      assert.equal(p3ModelPolicies.collection, "model_policies");
      assert.equal(p3ModelPolicies.count, 1);
      assert.equal(p3ModelPolicies.items[0].external_model_policy, "forbidden");

      const approvalToolPolicies = JSON.parse((await buildReviewApiResponse("/api/tool-policies?default_policy=approval_required", apiOptions)).body);
      assert.equal(approvalToolPolicies.collection, "tool_policies");
      assert.equal(approvalToolPolicies.count, policyMatrixCatalog.summary.approval_required_tool_count);

      const blockingGatePolicies = JSON.parse((await buildReviewApiResponse("/api/gate-policies?blocking_by_default=true", apiOptions)).body);
      assert.equal(blockingGatePolicies.collection, "gate_policies");
      assert.equal(blockingGatePolicies.count, policyMatrixCatalog.summary.blocking_gate_count);

      const policySnapshotLedgers = JSON.parse((await buildReviewApiResponse("/api/policy-snapshot-ledgers?ledger_status=valid", apiOptions)).body);
      assert.equal(policySnapshotLedgers.collection, "policy_snapshot_ledgers");
      assert.equal(policySnapshotLedgers.count, 1);

      const lawFirmPolicySnapshots = JSON.parse((await buildReviewApiResponse("/api/policy-snapshots?policy_snapshot_id=policy.default.law_firm.v1", apiOptions)).body);
      assert.equal(lawFirmPolicySnapshots.collection, "policy_snapshots");
      assert.equal(lawFirmPolicySnapshots.count, 1);

      const p2PolicyDecisions = JSON.parse((await buildReviewApiResponse("/api/policy-decisions?classification=P2_CLIENT_CONFIDENTIAL", apiOptions)).body);
      assert.equal(p2PolicyDecisions.collection, "policy_decisions");
      assert.equal(p2PolicyDecisions.count, 1);
      assert.equal(p2PolicyDecisions.items[0].external_model_policy, "approval_required");

      const workflowPolicyUsages = JSON.parse((await buildReviewApiResponse("/api/policy-usages?usage_type=workflow_run", apiOptions)).body);
      assert.equal(workflowPolicyUsages.collection, "policy_usages");
      assert.equal(workflowPolicyUsages.count, policySnapshotLedger.summary.workflow_usage_count);

      const contextPacketLedgers = JSON.parse((await buildReviewApiResponse("/api/context-packet-ledgers?ledger_status=valid", apiOptions)).body);
      assert.equal(contextPacketLedgers.collection, "context_packet_ledgers");
      assert.equal(contextPacketLedgers.count, 1);

      const codexContextPackets = JSON.parse((await buildReviewApiResponse("/api/context-packets?runtime_id=codex", apiOptions)).body);
      assert.equal(codexContextPackets.collection, "context_packets");
      assert.equal(codexContextPackets.count, 1);
      assert.equal(codexContextPackets.items[0].context_mode, "redacted");

      const redactedContextPackets = JSON.parse((await buildReviewApiResponse("/api/context-packets?context_mode=redacted", apiOptions)).body);
      assert.equal(redactedContextPackets.collection, "context_packets");
      assert.equal(redactedContextPackets.count, contextPacketLedger.summary.redacted_packet_count);

      const resourceContextItems = JSON.parse((await buildReviewApiResponse("/api/context-items?item_type=resource_metadata", apiOptions)).body);
      assert.equal(resourceContextItems.collection, "context_items");
      assert.ok(resourceContextItems.count >= 1);

      const completeRetrievalFilters = JSON.parse((await buildReviewApiResponse("/api/context-retrieval-filters?filter_status=complete", apiOptions)).body);
      assert.equal(completeRetrievalFilters.collection, "context_retrieval_filters");
      assert.equal(completeRetrievalFilters.count, contextPacketLedger.summary.retrieval_filter_count);

      const modelRoutingLedgers = JSON.parse((await buildReviewApiResponse("/api/model-routing-ledgers?ledger_status=valid", apiOptions)).body);
      assert.equal(modelRoutingLedgers.collection, "model_routing_ledgers");
      assert.equal(modelRoutingLedgers.count, 1);

      const codexModelRoutes = JSON.parse((await buildReviewApiResponse("/api/model-routing-decisions?runtime_id=codex", apiOptions)).body);
      assert.equal(codexModelRoutes.collection, "model_routing_decisions");
      assert.equal(codexModelRoutes.count, 1);
      assert.equal(codexModelRoutes.items[0].route_mode, "external_allowed_with_audit");

      const externalModelRoutes = JSON.parse((await buildReviewApiResponse("/api/model-routing-decisions?external_transfer=true", apiOptions)).body);
      assert.equal(externalModelRoutes.collection, "model_routing_decisions");
      assert.equal(externalModelRoutes.count, modelRoutingLedger.summary.external_transfer_count);

      const localModelRoutes = JSON.parse((await buildReviewApiResponse("/api/model-routing-decisions?route_mode=local_allowed", apiOptions)).body);
      assert.equal(localModelRoutes.collection, "model_routing_decisions");
      assert.ok(localModelRoutes.count >= 1);

      const costBudgetLedgers = JSON.parse((await buildReviewApiResponse("/api/cost-budget-ledgers?ledger_status=valid", apiOptions)).body);
      assert.equal(costBudgetLedgers.collection, "cost_budget_ledgers");
      assert.equal(costBudgetLedgers.count, 1);

      const passedCostBudgets = JSON.parse((await buildReviewApiResponse("/api/cost-budget-decisions?budget_status=passed", apiOptions)).body);
      assert.equal(passedCostBudgets.collection, "cost_budget_decisions");
      assert.equal(passedCostBudgets.count, costBudgetLedger.summary.passed_decision_count);

      const codexCostBudgets = JSON.parse((await buildReviewApiResponse("/api/cost-budget-decisions?runtime_id=codex", apiOptions)).body);
      assert.equal(codexCostBudgets.collection, "cost_budget_decisions");
      assert.equal(codexCostBudgets.count, 1);
      assert.equal(codexCostBudgets.items[0].budget_status, "passed");

      const tokenUsageLedgers = JSON.parse((await buildReviewApiResponse("/api/token-usage-ledgers?ledger_status=valid", apiOptions)).body);
      assert.equal(tokenUsageLedgers.collection, "token_usage_ledgers");
      assert.equal(tokenUsageLedgers.count, 1);

      const estimatedTokenUsage = JSON.parse((await buildReviewApiResponse("/api/token-usage-records?tracking_status=estimated", apiOptions)).body);
      assert.equal(estimatedTokenUsage.collection, "token_usage_records");
      assert.equal(estimatedTokenUsage.count, tokenUsageLedger.summary.estimated_record_count);

      const codexTokenUsage = JSON.parse((await buildReviewApiResponse("/api/token-usage-records?runtime_id=codex", apiOptions)).body);
      assert.equal(codexTokenUsage.collection, "token_usage_records");
      assert.equal(codexTokenUsage.count, 1);
      assert.equal(codexTokenUsage.items[0].tracking_status, "estimated");

      const costAttributionLedgers = JSON.parse((await buildReviewApiResponse("/api/cost-attribution-ledgers?ledger_status=valid", apiOptions)).body);
      assert.equal(costAttributionLedgers.collection, "cost_attribution_ledgers");
      assert.equal(costAttributionLedgers.count, 1);

      const attributedCosts = JSON.parse((await buildReviewApiResponse("/api/cost-attribution-records?attribution_status=attributed", apiOptions)).body);
      assert.equal(attributedCosts.collection, "cost_attribution_records");
      assert.equal(attributedCosts.count, costAttributionLedger.summary.attributed_record_count);

      const codexCostAttribution = JSON.parse((await buildReviewApiResponse("/api/cost-attribution-records?runtime_id=codex", apiOptions)).body);
      assert.equal(codexCostAttribution.collection, "cost_attribution_records");
      assert.equal(codexCostAttribution.count, 1);
      assert.equal(codexCostAttribution.items[0].attribution_status, "attributed");

      const budgetAlertLedgers = JSON.parse((await buildReviewApiResponse("/api/budget-alert-ledgers?ledger_status=valid", apiOptions)).body);
      assert.equal(budgetAlertLedgers.collection, "budget_alert_ledgers");
      assert.equal(budgetAlertLedgers.count, 1);

      const clearBudgetAlerts = JSON.parse((await buildReviewApiResponse("/api/budget-alert-records?alert_status=clear", apiOptions)).body);
      assert.equal(clearBudgetAlerts.collection, "budget_alert_records");
      assert.equal(clearBudgetAlerts.count, budgetAlertLedger.summary.clear_count);

      const codexBudgetAlerts = JSON.parse((await buildReviewApiResponse("/api/budget-alert-records?runtime_id=codex", apiOptions)).body);
      assert.equal(codexBudgetAlerts.collection, "budget_alert_records");
      assert.equal(codexBudgetAlerts.count, 1);
      assert.equal(codexBudgetAlerts.items[0].alert_status, "clear");

      const lawFirmPacks = JSON.parse((await buildReviewApiResponse("/api/packs?pack_id=law-firm", apiOptions)).body);
      assert.equal(lawFirmPacks.collection, "domain_packs");
      assert.equal(lawFirmPacks.count, 1);
      assert.equal(lawFirmPacks.items[0].pack_id, "law-firm");

      const lawFirmCapabilities = JSON.parse((await buildReviewApiResponse("/api/capabilities?pack_id=law-firm", apiOptions)).body);
      assert.equal(lawFirmCapabilities.collection, "capabilities");
      assert.ok(lawFirmCapabilities.items.some((capability) => capability.capability_id === "law_firm.ldd.issue_report"));

      const blockedArtifacts = JSON.parse((await buildReviewApiResponse("/api/artifacts?delivery_state=blocked_pending_approval", apiOptions)).body);
      assert.equal(blockedArtifacts.collection, "output_artifacts");
      assert.equal(blockedArtifacts.count, 3);
      assert.ok(blockedArtifacts.items.some((artifact) => artifact.domain_pack === "creative-document"));

      const codexRuns = JSON.parse((await buildReviewApiResponse("/api/runs?runtime_id=codex", apiOptions)).body);
      assert.equal(codexRuns.collection, "run_records");
      assert.equal(codexRuns.count, 1);
      assert.equal(codexRuns.items[0].capability_id, "personal_dev.codex.worktree_patch");

      const approvalEvents = JSON.parse((await buildReviewApiResponse("/api/events?event_type=approval.requested", apiOptions)).body);
      assert.equal(approvalEvents.collection, "event_records");
      assert.equal(approvalEvents.count, 3);

      const runtimeCosts = JSON.parse((await buildReviewApiResponse("/api/costs?cost_type=runtime_seconds", apiOptions)).body);
      assert.equal(runtimeCosts.collection, "cost_records");
      assert.equal(runtimeCosts.count, 3);

      const auditTrails = JSON.parse((await buildReviewApiResponse("/api/audit-trails?audit_status=complete", apiOptions)).body);
      assert.equal(auditTrails.collection, "audit_trails");
      assert.equal(auditTrails.count, 1);

      const deliveryAuditEvents = JSON.parse((await buildReviewApiResponse("/api/audit-events?event_type=delivery.executed", apiOptions)).body);
      assert.equal(deliveryAuditEvents.collection, "audit_events");
      assert.equal(deliveryAuditEvents.count, closeoutReceiptApplication.audit_events.length);

      const auditSources = JSON.parse((await buildReviewApiResponse("/api/audit-sources?available=true", apiOptions)).body);
      assert.equal(auditSources.collection, "audit_sources");
      assert.equal(auditSources.count, controlPlaneAuditTrail.summary.source_count);

      const pendingDeliveryActions = JSON.parse((await buildReviewApiResponse("/api/delivery-actions?delivery_status=blocked_pending_approval", apiOptions)).body);
      assert.equal(pendingDeliveryActions.collection, "delivery_actions");
      assert.equal(pendingDeliveryActions.count, 3);
      assert.ok(pendingDeliveryActions.items.some((action) => action.delivery_channel === "github"));

      const blockedMatters = JSON.parse((await buildReviewApiResponse("/api/matters?status=blocked", apiOptions)).body);
      assert.equal(blockedMatters.collection, "matters");
      assert.equal(blockedMatters.count, 3);
      assert.ok(blockedMatters.items.some((matter) => matter.matter_id === "matter.personal_dev.hermes"));

      const approvalRequests = JSON.parse((await buildReviewApiResponse("/api/approvals?item_type=approval_request", apiOptions)).body);
      assert.equal(approvalRequests.collection, "approval_items");
      assert.equal(approvalRequests.count, 3);
      assert.ok(approvalRequests.items.some((item) => item.delivery_channel === "github"));

      const appliedInboxDecisions = JSON.parse((await buildReviewApiResponse("/api/approval-inbox-decisions?decision=approve", apiOptions)).body);
      assert.equal(appliedInboxDecisions.collection, "approval_inbox_decisions");
      assert.equal(appliedInboxDecisions.count, 3);
      assert.ok(appliedInboxDecisions.items.every((item) => item.status_after === "approved"));

      const githubExecutionCandidates = JSON.parse((await buildReviewApiResponse("/api/delivery-execution-candidates?delivery_channel=github", apiOptions)).body);
      assert.equal(githubExecutionCandidates.collection, "delivery_execution_candidates");
      assert.equal(githubExecutionCandidates.count, 1);
      assert.equal(githubExecutionCandidates.items[0].execution_status, "draft_not_executed");

      const supportingDocumentPackets = JSON.parse((await buildReviewApiResponse("/api/delivery-execution-packets?delivery_target=supporting_document", apiOptions)).body);
      assert.equal(supportingDocumentPackets.collection, "delivery_execution_packets");
      assert.equal(supportingDocumentPackets.count, 1);
      assert.equal(supportingDocumentPackets.items[0].candidate_count, 2);

      const deliveredReceipts = JSON.parse((await buildReviewApiResponse("/api/delivery-receipts?receipt_status=delivered", apiOptions)).body);
      assert.equal(deliveredReceipts.collection, "delivery_receipts");
      assert.equal(deliveredReceipts.count, 4);
      assert.ok(deliveredReceipts.items.some((receipt) => receipt.delivery_channel === "github"));

      const deliveryEvents = JSON.parse((await buildReviewApiResponse("/api/delivery-receipt-events?type=delivery.executed", apiOptions)).body);
      assert.equal(deliveryEvents.collection, "delivery_receipt_events");
      assert.equal(deliveryEvents.count, 4);

      const deliveredMatters = JSON.parse((await buildReviewApiResponse("/api/post-delivery-matters?status=delivered", apiOptions)).body);
      assert.equal(deliveredMatters.collection, "post_delivery_matters");
      assert.equal(deliveredMatters.count, 3);

      const creativeDeliveredArtifacts = JSON.parse((await buildReviewApiResponse("/api/delivered-artifacts?domain_pack=creative-document", apiOptions)).body);
      assert.equal(creativeDeliveredArtifacts.collection, "delivered_artifacts");
      assert.equal(creativeDeliveredArtifacts.count, 3);

      const outstandingReceipts = JSON.parse((await buildReviewApiResponse("/api/outstanding-receipts", apiOptions)).body);
      assert.equal(outstandingReceipts.collection, "outstanding_receipts");
      assert.equal(outstandingReceipts.count, 0);

      const closeoutItems = JSON.parse((await buildReviewApiResponse("/api/delivery-closeout-items", apiOptions)).body);
      assert.equal(closeoutItems.collection, "delivery_closeout_items");
      assert.equal(closeoutItems.count, 0);

      const receiptDraftRows = JSON.parse((await buildReviewApiResponse("/api/receipt-input-drafts", apiOptions)).body);
      assert.equal(receiptDraftRows.collection, "receipt_input_drafts");
      assert.equal(receiptDraftRows.count, 0);

      const closeoutValidationItems = JSON.parse((await buildReviewApiResponse("/api/closeout-receipt-validations", apiOptions)).body);
      assert.equal(closeoutValidationItems.collection, "closeout_receipt_validations");
      assert.equal(closeoutValidationItems.count, 0);

      const closeoutValidationErrors = JSON.parse((await buildReviewApiResponse("/api/closeout-receipt-errors", apiOptions)).body);
      assert.equal(closeoutValidationErrors.collection, "closeout_receipt_errors");
      assert.equal(closeoutValidationErrors.count, 0);

      const validatedReceipts = JSON.parse((await buildReviewApiResponse("/api/validated-receipts-to-apply", apiOptions)).body);
      assert.equal(validatedReceipts.collection, "validated_receipts_to_apply");
      assert.equal(validatedReceipts.count, 0);

      const closeoutApplications = JSON.parse((await buildReviewApiResponse("/api/closeout-receipt-applications?application_status=applied", apiOptions)).body);
      assert.equal(closeoutApplications.collection, "closeout_receipt_applications");
      assert.equal(closeoutApplications.count, 1);

      const closeoutAppliedReceipts = JSON.parse((await buildReviewApiResponse("/api/closeout-applied-receipts?receipt_status=delivered", apiOptions)).body);
      assert.equal(closeoutAppliedReceipts.collection, "closeout_applied_receipts");
      assert.equal(closeoutAppliedReceipts.count, 4);

      const pipelineRuns = JSON.parse((await buildReviewApiResponse("/api/pipeline-runs?pipeline_id=control-plane-pipeline.20260523T063504", apiOptions)).body);
      assert.equal(pipelineRuns.collection, "pipeline_runs");
      assert.equal(pipelineRuns.count, 1);

      const pipelineSteps = JSON.parse((await buildReviewApiResponse("/api/pipeline-steps?status=passed", apiOptions)).body);
      assert.equal(pipelineSteps.collection, "pipeline_steps");
      assert.equal(pipelineSteps.count, 2);

      const controlPlaneLoops = JSON.parse((await buildReviewApiResponse("/api/control-plane-loops?loop_status=passed", apiOptions)).body);
      assert.equal(controlPlaneLoops.collection, "control_plane_loops");
      assert.equal(controlPlaneLoops.count, 1);

      const controlPlaneLoopSteps = JSON.parse((await buildReviewApiResponse("/api/control-plane-loop-steps?status=passed", apiOptions)).body);
      assert.equal(controlPlaneLoopSteps.collection, "control_plane_loop_steps");
      assert.equal(controlPlaneLoopSteps.count, 1);

      const goalCheckpoints = JSON.parse((await buildReviewApiResponse("/api/goal-checkpoints?checkpoint_id=control-plane-goal-checkpoint.20260523T063508", apiOptions)).body);
      assert.equal(goalCheckpoints.collection, "goal_checkpoints");
      assert.equal(goalCheckpoints.count, 1);

      const passedGoalCheckpointItems = JSON.parse((await buildReviewApiResponse("/api/goal-checkpoint-items?status=passed", apiOptions)).body);
      assert.equal(passedGoalCheckpointItems.collection, "goal_checkpoint_items");
      assert.ok(passedGoalCheckpointItems.count >= 1);

      const controlPlaneHealthItems = JSON.parse((await buildReviewApiResponse("/api/control-plane-health?health_id=control-plane-health.20260523T063504", apiOptions)).body);
      assert.equal(controlPlaneHealthItems.collection, "control_plane_health");
      assert.equal(controlPlaneHealthItems.count, 1);

      const blockedHealthChecks = JSON.parse((await buildReviewApiResponse("/api/health-checks?status=blocked", apiOptions)).body);
      assert.equal(blockedHealthChecks.collection, "health_checks");
      assert.ok(blockedHealthChecks.count >= 1);

      const actionPlans = JSON.parse((await buildReviewApiResponse("/api/action-plans?plan_id=control-plane-action-plan.20260523T063505", apiOptions)).body);
      assert.equal(actionPlans.collection, "action_plans");
      assert.equal(actionPlans.count, 1);

      const humanActionPlanItems = JSON.parse((await buildReviewApiResponse("/api/action-plan-items?requires_human=true", apiOptions)).body);
      assert.equal(humanActionPlanItems.collection, "action_plan_items");
      assert.ok(humanActionPlanItems.count >= 1);

      const humanGates = JSON.parse((await buildReviewApiResponse("/api/human-gates?human_gate_id=control-plane-human-gates.20260523T063505", apiOptions)).body);
      assert.equal(humanGates.collection, "human_gates");
      assert.equal(humanGates.count, 1);

      const evidenceHumanGateItems = JSON.parse((await buildReviewApiResponse("/api/human-gate-items?limit=5", apiOptions)).body);
      assert.equal(evidenceHumanGateItems.collection, "human_gate_items");
      assert.ok(evidenceHumanGateItems.count >= 1);

      const humanGateReceipts = JSON.parse((await buildReviewApiResponse("/api/human-gate-receipts?receipt_status=pending_receipts", apiOptions)).body);
      assert.equal(humanGateReceipts.collection, "human_gate_receipts");
      assert.equal(humanGateReceipts.count, 1);

      const humanGateReceiptRequirements = JSON.parse((await buildReviewApiResponse("/api/human-gate-receipt-requirements?limit=5", apiOptions)).body);
      assert.equal(humanGateReceiptRequirements.collection, "human_gate_receipt_requirements");
      assert.ok(humanGateReceiptRequirements.count >= 1);

      const humanGateReceiptDrafts = JSON.parse((await buildReviewApiResponse("/api/human-gate-receipt-drafts?receipt_status=pending", apiOptions)).body);
      assert.equal(humanGateReceiptDrafts.collection, "human_gate_receipt_drafts");
      assert.ok(humanGateReceiptDrafts.count >= 1);

      const humanReviewPacketLedgers = JSON.parse((await buildReviewApiResponse("/api/human-review-packet-ledgers?review_status=pending_review", apiOptions)).body);
      assert.equal(humanReviewPacketLedgers.collection, "human_review_packet_ledgers");
      assert.equal(humanReviewPacketLedgers.count, 1);

      const attorneyReviewPackets = JSON.parse((await buildReviewApiResponse("/api/human-review-packets?required_actor=attorney_or_designated_reviewer", apiOptions)).body);
      assert.equal(attorneyReviewPackets.collection, "human_review_packets");
      assert.ok(attorneyReviewPackets.count >= 1);

      const pendingHumanReviewItems = JSON.parse((await buildReviewApiResponse("/api/human-review-items?receipt_status=pending", apiOptions)).body);
      assert.equal(pendingHumanReviewItems.collection, "human_review_items");
      assert.ok(pendingHumanReviewItems.count >= 1);

      const humanReviewAgendas = JSON.parse((await buildReviewApiResponse("/api/human-review-agendas?agenda_status=pending_review", apiOptions)).body);
      assert.equal(humanReviewAgendas.collection, "human_review_agendas");
      assert.equal(humanReviewAgendas.count, 1);

      const attorneyReviewAgendaSections = JSON.parse((await buildReviewApiResponse("/api/human-review-agenda-sections?required_actor=attorney_or_designated_reviewer", apiOptions)).body);
      assert.equal(attorneyReviewAgendaSections.collection, "human_review_agenda_sections");
      assert.ok(attorneyReviewAgendaSections.count >= 1);

      const pendingHumanReviewAgendaItems = JSON.parse((await buildReviewApiResponse("/api/human-review-agenda-items?agenda_status=pending_human_review", apiOptions)).body);
      assert.equal(pendingHumanReviewAgendaItems.collection, "human_review_agenda_items");
      assert.ok(pendingHumanReviewAgendaItems.count >= 1);

      const humanReviewDecisionRows = JSON.parse((await buildReviewApiResponse("/api/human-review-decision-template?receipt_status=pending", apiOptions)).body);
      assert.equal(humanReviewDecisionRows.collection, "human_review_decision_template");
      assert.equal(humanReviewDecisionRows.count, humanReviewAgenda.summary.decision_template_row_count);

      const humanReviewAgendaReceiptIntakes = JSON.parse((await buildReviewApiResponse("/api/human-review-agenda-receipt-intakes?intake_status=pending_receipts", apiOptions)).body);
      assert.equal(humanReviewAgendaReceiptIntakes.collection, "human_review_agenda_receipt_intakes");
      assert.equal(humanReviewAgendaReceiptIntakes.count, 1);

      const pendingAgendaReceiptIntakeItems = JSON.parse((await buildReviewApiResponse("/api/human-review-agenda-receipt-intake-items?intake_status=pending_receipt", apiOptions)).body);
      assert.equal(pendingAgendaReceiptIntakeItems.collection, "human_review_agenda_receipt_intake_items");
      assert.equal(pendingAgendaReceiptIntakeItems.count, humanReviewAgendaReceiptIntake.summary.pending_receipt_count);

      const agendaReceiptInputRows = JSON.parse((await buildReviewApiResponse("/api/human-review-agenda-receipt-input?receipt_status=pending", apiOptions)).body);
      assert.equal(agendaReceiptInputRows.collection, "human_review_agenda_receipt_input");
      assert.equal(agendaReceiptInputRows.count, humanReviewAgendaReceiptIntake.summary.receipt_row_count);

      const humanReviewReceiptWorkspaces = JSON.parse((await buildReviewApiResponse("/api/human-review-receipt-workspaces?workspace_status=pending_human_review", apiOptions)).body);
      assert.equal(humanReviewReceiptWorkspaces.collection, "human_review_receipt_workspaces");
      assert.equal(humanReviewReceiptWorkspaces.count, 1);

      const humanReviewActorWorkspaces = JSON.parse((await buildReviewApiResponse("/api/human-review-actor-workspaces?workspace_status=pending_human_review", apiOptions)).body);
      assert.equal(humanReviewActorWorkspaces.collection, "human_review_actor_workspaces");
      assert.equal(humanReviewActorWorkspaces.count, humanReviewReceiptWorkspace.summary.actor_workspace_count);

      const humanReviewWorkspaceEntries = JSON.parse((await buildReviewApiResponse("/api/human-review-workspace-entries?receipt_status=pending", apiOptions)).body);
      assert.equal(humanReviewWorkspaceEntries.collection, "human_review_workspace_entries");
      assert.equal(humanReviewWorkspaceEntries.count, humanReviewReceiptWorkspace.summary.pending_receipt_count);

      const humanReviewReceiptWorkspaceMerges = JSON.parse((await buildReviewApiResponse("/api/human-review-receipt-workspace-merges?merge_status=pending_receipts", apiOptions)).body);
      assert.equal(humanReviewReceiptWorkspaceMerges.collection, "human_review_receipt_workspace_merges");
      assert.equal(humanReviewReceiptWorkspaceMerges.count, 1);

      const humanReviewReceiptMergeItems = JSON.parse((await buildReviewApiResponse("/api/human-review-receipt-merge-items?merge_status=pending_receipt", apiOptions)).body);
      assert.equal(humanReviewReceiptMergeItems.collection, "human_review_receipt_merge_items");
      assert.equal(humanReviewReceiptMergeItems.count, humanReviewReceiptWorkspaceMerge.summary.pending_receipt_count);

      const humanReviewMergedReceiptInput = JSON.parse((await buildReviewApiResponse("/api/human-review-merged-receipt-input?receipt_status=pending", apiOptions)).body);
      assert.equal(humanReviewMergedReceiptInput.collection, "human_review_merged_receipt_input");
      assert.equal(humanReviewMergedReceiptInput.count, humanReviewReceiptWorkspaceMerge.summary.receipt_row_count);

      const humanReviewContextBundles = JSON.parse((await buildReviewApiResponse("/api/human-review-context-bundles?bundle_status=pending_human_review", apiOptions)).body);
      assert.equal(humanReviewContextBundles.collection, "human_review_context_bundles");
      assert.equal(humanReviewContextBundles.count, 1);

      const readyHumanReviewContextCards = JSON.parse((await buildReviewApiResponse("/api/human-review-context-cards?context_status=ready", apiOptions)).body);
      assert.equal(readyHumanReviewContextCards.collection, "human_review_context_cards");
      assert.equal(readyHumanReviewContextCards.count, humanReviewContextBundle.summary.ready_context_count);

      const attorneyHumanReviewContextBundles = JSON.parse((await buildReviewApiResponse("/api/human-review-actor-context-bundles?required_actor=attorney_or_designated_reviewer", apiOptions)).body);
      assert.equal(attorneyHumanReviewContextBundles.collection, "human_review_actor_context_bundles");
      assert.equal(attorneyHumanReviewContextBundles.count, 1);

      const humanReviewDecisionRegisters = JSON.parse((await buildReviewApiResponse("/api/human-review-decision-registers?register_status=pending_human_review", apiOptions)).body);
      assert.equal(humanReviewDecisionRegisters.collection, "human_review_decision_registers");
      assert.equal(humanReviewDecisionRegisters.count, 1);

      const pendingHumanReviewDecisionRows = JSON.parse((await buildReviewApiResponse("/api/human-review-decision-rows?decision_status=pending_decision", apiOptions)).body);
      assert.equal(pendingHumanReviewDecisionRows.collection, "human_review_decision_rows");
      assert.equal(pendingHumanReviewDecisionRows.count, humanReviewDecisionRegister.summary.pending_decision_count);

      const humanReviewDecisionReceiptInput = JSON.parse((await buildReviewApiResponse("/api/human-review-decision-receipt-input?receipt_status=pending", apiOptions)).body);
      assert.equal(humanReviewDecisionReceiptInput.collection, "human_review_decision_receipt_input");
      assert.equal(humanReviewDecisionReceiptInput.count, humanReviewDecisionRegister.summary.receipt_row_count);

      const humanReviewDecisionRegisterMerges = JSON.parse((await buildReviewApiResponse("/api/human-review-decision-register-merges?merge_status=pending_receipts", apiOptions)).body);
      assert.equal(humanReviewDecisionRegisterMerges.collection, "human_review_decision_register_merges");
      assert.equal(humanReviewDecisionRegisterMerges.count, 1);

      const humanReviewDecisionMergeItems = JSON.parse((await buildReviewApiResponse("/api/human-review-decision-merge-items?merge_status=pending_receipt", apiOptions)).body);
      assert.equal(humanReviewDecisionMergeItems.collection, "human_review_decision_merge_items");
      assert.equal(humanReviewDecisionMergeItems.count, humanReviewDecisionRegisterMerge.summary.pending_receipt_count);

      const humanReviewMergedDecisionReceiptInput = JSON.parse((await buildReviewApiResponse("/api/human-review-merged-decision-receipt-input?receipt_status=pending", apiOptions)).body);
      assert.equal(humanReviewMergedDecisionReceiptInput.collection, "human_review_merged_decision_receipt_input");
      assert.equal(humanReviewMergedDecisionReceiptInput.count, humanReviewDecisionRegisterMerge.summary.receipt_row_count);

      const pendingHumanGateReceiptValidations = JSON.parse((await buildReviewApiResponse("/api/human-gate-receipt-validations?validation_status=pending_receipt", apiOptions)).body);
      assert.equal(pendingHumanGateReceiptValidations.collection, "human_gate_receipt_validations");
      assert.ok(pendingHumanGateReceiptValidations.count >= 1);

      const humanGateReceiptErrors = JSON.parse((await buildReviewApiResponse("/api/human-gate-receipt-errors", apiOptions)).body);
      assert.equal(humanGateReceiptErrors.collection, "human_gate_receipt_errors");
      assert.equal(humanGateReceiptErrors.count, 0);

      const humanReviewValidationFeedbacks = JSON.parse((await buildReviewApiResponse("/api/human-review-validation-feedbacks?feedback_status=pending_human_review", apiOptions)).body);
      assert.equal(humanReviewValidationFeedbacks.collection, "human_review_validation_feedbacks");
      assert.equal(humanReviewValidationFeedbacks.count, 1);

      const humanReviewFeedbackItems = JSON.parse((await buildReviewApiResponse("/api/human-review-feedback-items?feedback_status=needs_human_decision", apiOptions)).body);
      assert.equal(humanReviewFeedbackItems.collection, "human_review_feedback_items");
      assert.equal(humanReviewFeedbackItems.count, humanReviewValidationFeedback.summary.pending_receipt_count);

      const humanReviewActorFeedback = JSON.parse((await buildReviewApiResponse("/api/human-review-actor-feedback?required_actor=attorney_or_designated_reviewer", apiOptions)).body);
      assert.equal(humanReviewActorFeedback.collection, "human_review_actor_feedback");
      assert.equal(humanReviewActorFeedback.count, 1);

      const validatedHumanGateReceipts = JSON.parse((await buildReviewApiResponse("/api/validated-human-gate-receipts", apiOptions)).body);
      assert.equal(validatedHumanGateReceipts.collection, "validated_human_gate_receipts");
      assert.equal(validatedHumanGateReceipts.count, 0);

      const humanGateReceiptApplications = JSON.parse((await buildReviewApiResponse("/api/human-gate-receipt-applications?application_status=nothing_to_apply", apiOptions)).body);
      assert.equal(humanGateReceiptApplications.collection, "human_gate_receipt_applications");
      assert.equal(humanGateReceiptApplications.count, 1);

      const appliedHumanGateReceipts = JSON.parse((await buildReviewApiResponse("/api/applied-human-gate-receipts", apiOptions)).body);
      assert.equal(appliedHumanGateReceipts.collection, "applied_human_gate_receipts");
      assert.equal(appliedHumanGateReceipts.count, 0);

      const patchedHumanGateItems = JSON.parse((await buildReviewApiResponse("/api/patched-human-gate-items", apiOptions)).body);
      assert.equal(patchedHumanGateItems.collection, "patched_human_gate_items");
      assert.equal(patchedHumanGateItems.count, 0);

      const humanWorkPackets = JSON.parse((await buildReviewApiResponse("/api/action-work-packets?requires_human=true", apiOptions)).body);
      assert.equal(humanWorkPackets.collection, "action_work_packets");
      assert.ok(humanWorkPackets.count >= 1);

      const matterWorkItems = JSON.parse((await buildReviewApiResponse("/api/action-work-items?source_stage=matter_cockpit", apiOptions)).body);
      assert.equal(matterWorkItems.collection, "action_work_items");
      assert.ok(matterWorkItems.count >= 1);

      const humanReceiptRequirements = JSON.parse((await buildReviewApiResponse("/api/work-packet-receipt-requirements?requires_human=true", apiOptions)).body);
      assert.equal(humanReceiptRequirements.collection, "work_packet_receipt_requirements");
      assert.ok(humanReceiptRequirements.count >= 1);

      const pendingPacketReceipts = JSON.parse((await buildReviewApiResponse("/api/work-packet-receipt-drafts?receipt_status=pending", apiOptions)).body);
      assert.equal(pendingPacketReceipts.collection, "work_packet_receipt_drafts");
      assert.ok(pendingPacketReceipts.count >= 1);

      const pendingPacketReceiptValidations = JSON.parse((await buildReviewApiResponse("/api/work-packet-receipt-validations?validation_status=pending_receipt", apiOptions)).body);
      assert.equal(pendingPacketReceiptValidations.collection, "work_packet_receipt_validations");
      assert.ok(pendingPacketReceiptValidations.count >= 1);

      const packetReceiptErrors = JSON.parse((await buildReviewApiResponse("/api/work-packet-receipt-errors", apiOptions)).body);
      assert.equal(packetReceiptErrors.collection, "work_packet_receipt_errors");
      assert.equal(packetReceiptErrors.count, 0);

      const validatedPacketReceipts = JSON.parse((await buildReviewApiResponse("/api/validated-work-packet-receipts", apiOptions)).body);
      assert.equal(validatedPacketReceipts.collection, "validated_work_packet_receipts");
      assert.equal(validatedPacketReceipts.count, 0);

      const packetReceiptApplications = JSON.parse((await buildReviewApiResponse("/api/work-packet-receipt-applications?application_status=nothing_to_apply", apiOptions)).body);
      assert.equal(packetReceiptApplications.collection, "work_packet_receipt_applications");
      assert.equal(packetReceiptApplications.count, 1);

      const appliedPacketReceipts = JSON.parse((await buildReviewApiResponse("/api/applied-work-packet-receipts", apiOptions)).body);
      assert.equal(appliedPacketReceipts.collection, "applied_work_packet_receipts");
      assert.equal(appliedPacketReceipts.count, 0);

      const health = JSON.parse((await buildReviewApiResponse("/health", apiOptions)).body);
      assert.equal(health.dashboard_available, true);
      assert.equal(health.overall_status, "blocked");
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("loads core contract schemas and the vertical slice example", async () => {
    const schemaFiles = (await readdir("schemas/core"))
      .filter((file) => file.endsWith(".schema.json"))
      .sort();
    assert.deepEqual(schemaFiles, [
      "capability-manifest.schema.json",
      "common.schema.json",
      "event-ledger.schema.json",
      "governance-output.schema.json",
      "identity-policy.schema.json",
      "policy-matrix.schema.json",
      "resource-evidence.schema.json",
      "runtime-adapter.schema.json",
      "workflow-runtime.schema.json",
    ]);

    for (const schemaFile of schemaFiles) {
      const schema = JSON.parse(await readFile(`schemas/core/${schemaFile}`, "utf8"));
      assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
      assert.ok(schema.$id.includes("/hermes/core/"));
    }

    const slice = JSON.parse(await readFile("examples/core/vertical-slice-example.json", "utf8"));
    assert.equal(slice.schema_version, "vertical-slice-example.v1");
    assert.equal(slice.identity_policy.matters[0].id, "matter.alpha.ldd");
    assert.equal(slice.resource_evidence.resources[0].matter_id, "matter.alpha.ldd");
    assert.equal(slice.workflow_runtime.workflow_runs[0].policy_snapshot_id, "policy.default.law_firm.v1");
    assert.equal(slice.governance_output.output_artifacts[0].citation_ids[0], "citation.alpha.output.001.p1");
    assert.equal(slice.governance_output.approvals[0].approval_status, "pending");
  });

  it("validates the vertical slice against core schemas and references", async () => {
    const result = await validateVerticalSliceFile("examples/core/vertical-slice-example.json");
    assert.deepEqual(result.errors, []);
    assert.equal(result.valid, true);
  });

  it("validates the policy matrix against schema and semantic rules", async () => {
    const result = await validatePolicyMatrixFile("examples/core/policy-matrix.json");
    assert.deepEqual(result.errors, []);
    assert.equal(result.valid, true);
  });

  it("validates capability manifests against schema and policy matrix", async () => {
    const lawFirmResult = await validateCapabilityManifestFile(
      "examples/core/capabilities/law-firm-ldd-vdr-inventory.json",
    );
    const personalDevResult = await validateCapabilityManifestFile(
      "examples/core/capabilities/personal-dev-codex-worktree.json",
    );
    assert.deepEqual(lawFirmResult.errors, []);
    assert.deepEqual(personalDevResult.errors, []);
    assert.equal(lawFirmResult.valid, true);
    assert.equal(personalDevResult.valid, true);
  });

  it("builds and validates the domain pack registry", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "hermes-domain-packs-"));
    try {
      const registry = await runDomainPackRegistry({
        outDir,
        runAt: "2026-05-23T07:55:00.000Z",
      });
      const registrySchema = JSON.parse(await readFile("schemas/domain-pack-registry.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(registry, registrySchema, {}, "domain_pack_registry"), []);
      assert.equal(registry.validation.valid, true);
      assert.equal(registry.summary.pack_count, 4);
      assert.equal(registry.summary.capability_count, 4);
      assert.ok(registry.packs.some((pack) => pack.pack_id === "law-firm"));
      assert.ok(registry.packs.some((pack) => pack.pack_id === "personal-dev"));
      assert.ok(registry.packs.some((pack) => pack.pack_id === "creative-document"));
      assert.ok(registry.capabilities.some((capability) => capability.capability_id === "creative_document.pptx.design_system"));
      assert.ok(registry.capabilities.some((capability) => capability.capability_id === "law_firm.ldd.issue_report"));
      assert.match(await readFile(path.join(outDir, "summary.md"), "utf8"), /Domain Pack Registry/);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("records control plane pipeline failures and missing artifacts", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "hermes-control-plane-pipeline-"));
    try {
      const pipeline = await runControlPlanePipeline({
        outDir,
        cwd: process.cwd(),
        runAt: "2026-05-23T08:05:00.000Z",
        steps: [
          {
            step_id: "pass_step",
            label: "Pass Step",
            category: "test",
            command: [process.execPath, "-e", "console.log('ok')"],
            expected_artifacts: [],
          },
          {
            step_id: "missing_artifact_step",
            label: "Missing Artifact Step",
            category: "test",
            command: [process.execPath, "-e", "console.log('missing')"],
            expected_artifacts: [path.join(outDir, "missing.json")],
          },
          {
            step_id: "fail_step",
            label: "Fail Step",
            category: "test",
            command: [process.execPath, "-e", "console.error('bad'); process.exit(2)"],
            expected_artifacts: [],
          },
        ],
      });
      const schema = JSON.parse(await readFile("schemas/control-plane-pipeline.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(pipeline, schema, {}, "control_plane_pipeline_failure"), []);
      assert.equal(pipeline.summary.step_count, 3);
      assert.equal(pipeline.summary.passed_step_count, 1);
      assert.equal(pipeline.summary.artifact_missing_step_count, 1);
      assert.equal(pipeline.summary.failed_step_count, 1);
      assert.equal(pipeline.summary.missing_artifact_count, 1);
      assert.equal(pipeline.summary.overall_status, "failed");
      assert.match(await readFile(path.join(outDir, "summary.md"), "utf8"), /Control Plane Pipeline/);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("classifies evidence decisions as human-gated action plan items", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "hermes-action-plan-human-gate-"));
    try {
      const dashboardPath = path.join(outDir, "dashboard.json");
      const healthPath = path.join(outDir, "health.json");
      await writeFile(
        dashboardPath,
        `${JSON.stringify({
          schema_version: "review-dashboard.v1",
          generated_at: "2026-05-23T12:40:00.000Z",
          summary: {},
          action_items: [
            {
              action_item_id: "dashboard.action.approval-item.evidence.synthetic",
              source_stage: "approval_queue",
              priority: "medium",
              status: "pending",
              title: "Review evidence: synthetic",
              subject_ref: {
                subject_type: "evidence_item",
                subject_id: "evidence.synthetic",
              },
              reason: "Machine-extracted evidence requires human review before downstream use.",
              recommended_actions: ["approve_evidence", "reject_evidence", "request_reextract", "assign_matter"],
              source_ref: "approval-item.evidence.synthetic",
            },
          ],
        }, null, 2)}\n`,
        "utf8",
      );
      await writeFile(
        healthPath,
        `${JSON.stringify({
          schema_version: "control-plane-health.v1",
          generated_at: "2026-05-23T12:40:00.000Z",
          health_checks: [],
        }, null, 2)}\n`,
        "utf8",
      );
      const actionPlan = await runControlPlaneActionPlan({
        dashboardPath,
        healthPath,
        outDir: path.join(outDir, "action-plan"),
        runAt: "2026-05-23T12:40:01.000Z",
      });
      const schema = JSON.parse(await readFile("schemas/control-plane-action-plan.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(actionPlan, schema, {}, "control_plane_action_plan_human_gate"), []);
      assert.equal(actionPlan.summary.ready_to_run_count, 0);
      assert.equal(actionPlan.summary.waiting_for_human_count, 1);
      assert.equal(actionPlan.summary.human_required_count, 1);
      assert.equal(actionPlan.plan_items[0].status, "waiting_for_human");
      assert.equal(actionPlan.plan_items[0].requires_human, true);
      assert.equal(actionPlan.plan_items[0].next_commands.length, 0);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("validates filled control plane human gate receipts", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "hermes-human-gate-validation-"));
    try {
      const receiptDraftsPath = path.join(root, "human-gate-receipts.json");
      const receiptInputPath = path.join(root, "receipt-input.json");
      await writeFile(
        receiptDraftsPath,
        `${JSON.stringify({
          schema_version: "control-plane-human-gate-receipt-drafts.v1",
          generated_at: "2026-05-23T13:20:00.000Z",
          receipt_draft_id: "control-plane-human-gate-receipts.test",
          output_dir: root,
          receipt_status: "pending_receipts",
          sources: [],
          summary: {
            receipt_status: "pending_receipts",
            human_gates_available: true,
            source_human_gate_id: "control-plane-human-gates.test",
            source_gate_item_count: 1,
            receipt_requirement_count: 1,
            receipt_draft_count: 1,
            pending_receipt_count: 1,
            protected_receipt_count: 0,
            human_receipt_count: 1,
            evidence_decision_receipt_count: 1,
            command_receipt_count: 0,
            required_field_count: 7,
            by_gate_type: { evidence_decision: 1 },
            by_source_stage: { evidence_viewer: 1 },
          },
          receipt_requirements: [
            {
              receipt_requirement_id: "human-gate-receipt-requirement.test",
              gate_item_id: "human-gate.test",
              source_plan_item_id: "plan-item.test",
              source_stage: "evidence_viewer",
              gate_type: "evidence_decision",
              priority: "high",
              gate_status: "waiting_for_human",
              subject_ref: { subject_type: "evidence", subject_id: "evidence.test" },
              requires_human: true,
              protected_action: false,
              required_actor: "attorney_or_owner",
              receipt_required: false,
              decision_required: true,
              allowed_outcomes: ["approve_evidence", "reject_evidence", "request_reextract", "assign_matter", "defer"],
              required_receipt_fields: ["receipt_status", "outcome", "decided_by", "decided_at", "decision_reference", "decision_notes", "reviewer", "completed_action_refs"],
              acceptance_criteria: ["decision_reference points to the evidence review record"],
              next_commands: [],
              receipt_form_draft: {
                receipt_id: "human-gate-receipt.test",
                gate_item_id: "human-gate.test",
                source_plan_item_id: "plan-item.test",
                gate_type: "evidence_decision",
                receipt_status: "pending",
                outcome: "pending",
                decided_by: "",
                decided_at: "",
                reviewer: "",
                decision_reference: "",
                decision_notes: "",
                protected_action_reference: null,
                command_result: null,
                commands_run: [],
                completed_action_refs: [],
                required_receipt_fields: ["receipt_status", "outcome", "decided_by", "decided_at", "decision_reference", "decision_notes", "reviewer", "completed_action_refs"],
                generated_at: "2026-05-23T13:20:00.000Z",
              },
            },
          ],
          receipt_input_draft: {
            schema_version: "control-plane-human-gate-receipts-input.v1",
            generated_at: "2026-05-23T13:20:00.000Z",
            human_gate_id: "control-plane-human-gates.test",
            instructions: "test",
            receipts: [],
          },
        }, null, 2)}\n`,
        "utf8",
      );
      await writeFile(
        receiptInputPath,
        `${JSON.stringify({
          schema_version: "control-plane-human-gate-receipts-input.v1",
          generated_at: "2026-05-23T13:21:00.000Z",
          human_gate_id: "control-plane-human-gates.test",
          instructions: "filled test receipt",
          receipts: [
            {
              receipt_id: "human-gate-receipt.test",
              gate_item_id: "human-gate.test",
              source_plan_item_id: "plan-item.test",
              gate_type: "evidence_decision",
              receipt_status: "resolved",
              outcome: "approve_evidence",
              decided_by: "jws",
              decided_at: "2026-05-23T13:21:30.000Z",
              reviewer: "jws",
              decision_reference: "approval-decisions.test",
              decision_notes: "Evidence reviewed and approved.",
              protected_action_reference: null,
              command_result: null,
              commands_run: [],
              completed_action_refs: ["approval-decisions.test"],
              required_receipt_fields: ["receipt_status", "outcome", "decided_by", "decided_at", "decision_reference", "decision_notes", "reviewer", "completed_action_refs"],
              generated_at: "2026-05-23T13:21:00.000Z",
            },
          ],
        }, null, 2)}\n`,
        "utf8",
      );

      const validation = await runControlPlaneHumanGateReceiptValidation({
        receiptDraftsPath,
        receiptInputPath,
        outDir: path.join(root, "validation"),
        runAt: "2026-05-23T13:22:00.000Z",
      });
      const schema = JSON.parse(await readFile("schemas/control-plane-human-gate-receipt-validation.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(validation, schema, {}, "control_plane_human_gate_receipt_validation_ready"), []);
      assert.equal(validation.validation_status, "ready_to_apply");
      assert.equal(validation.summary.ready_to_apply_count, 1);
      assert.equal(validation.summary.pending_receipt_count, 0);
      assert.equal(validation.summary.evidence_decision_ready_count, 1);
      assert.equal(validation.validated_receipts_to_apply.receipts[0].outcome, "approve_evidence");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("applies validated control plane human gate receipts without executing protected actions", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "hermes-human-gate-application-"));
    try {
      const validationPath = path.join(root, "validation.json");
      const humanGatesPath = path.join(root, "human-gates.json");
      await writeFile(
        validationPath,
        `${JSON.stringify({
          schema_version: "control-plane-human-gate-receipt-validation.v1",
          generated_at: "2026-05-23T13:25:00.000Z",
          validation_id: "control-plane-human-gate-receipt-validation.test",
          output_dir: root,
          validation_status: "ready_to_apply",
          sources: [],
          summary: {
            validation_status: "ready_to_apply",
            receipt_drafts_available: true,
            receipt_input_available: true,
            receipt_requirement_count: 1,
            receipt_count: 1,
            validation_item_count: 1,
            ready_to_apply_count: 1,
            pending_receipt_count: 0,
            missing_receipt_count: 0,
            invalid_receipt_count: 0,
            unknown_receipt_count: 0,
            error_count: 0,
            protected_ready_count: 0,
            human_ready_count: 1,
            evidence_decision_ready_count: 1,
            command_ready_count: 0,
            by_validation_status: { ready_to_apply: 1 },
            by_receipt_status: { resolved: 1 },
            by_gate_type: { evidence_decision: 1 },
            by_source_stage: { evidence_viewer: 1 },
          },
          validation_items: [],
          receipt_errors: [],
          validated_receipts_to_apply: {
            schema_version: "control-plane-human-gate-receipts-input.v1",
            generated_at: "2026-05-23T13:25:00.000Z",
            human_gate_id: "control-plane-human-gates.test",
            instructions: "test",
            receipts: [
              {
                receipt_id: "human-gate-receipt.test",
                gate_item_id: "human-gate.test",
                source_plan_item_id: "plan-item.test",
                gate_type: "evidence_decision",
                receipt_status: "resolved",
                outcome: "approve_evidence",
                decided_by: "jws",
                decided_at: "2026-05-23T13:25:30.000Z",
                reviewer: "jws",
                decision_reference: "approval-decisions.test",
                decision_notes: "Evidence reviewed and approved.",
                protected_action_reference: null,
                command_result: null,
                commands_run: [],
                completed_action_refs: ["approval-decisions.test"],
                required_receipt_fields: ["receipt_status", "outcome", "decided_by", "decided_at", "decision_reference", "decision_notes", "reviewer", "completed_action_refs"],
                generated_at: "2026-05-23T13:24:00.000Z",
              },
            ],
          },
        }, null, 2)}\n`,
        "utf8",
      );
      await writeFile(
        humanGatesPath,
        `${JSON.stringify({
          schema_version: "control-plane-human-gates.v1",
          generated_at: "2026-05-23T13:24:00.000Z",
          human_gate_id: "control-plane-human-gates.test",
          source_action_plan: "control-plane-action-plan.test",
          source_action_plan_id: "control-plane-action-plan.test",
          output_dir: root,
          policy: {
            auto_execute_allowed: false,
            protected_actions_require_receipt: true,
            evidence_decisions_require_human: true,
            generated_outputs_remain_draft_only: true,
          },
          summary: {
            gate_item_count: 1,
            waiting_for_human_count: 1,
            blocked_count: 0,
            protected_action_count: 0,
            human_required_count: 1,
            evidence_decision_count: 1,
            approval_request_count: 0,
            protected_delivery_count: 0,
            closeout_receipt_count: 0,
            auto_execute_allowed_count: 0,
            next_command_count: 0,
            by_gate_type: { evidence_decision: 1 },
            by_priority: { high: 1 },
            by_status: { waiting_for_human: 1 },
            by_source_stage: { evidence_viewer: 1 },
          },
          agenda: [],
          gate_items: [
            {
              gate_item_id: "human-gate.test",
              source_plan_item_id: "plan-item.test",
              source_stage: "evidence_viewer",
              gate_type: "evidence_decision",
              priority: "high",
              status: "waiting_for_human",
              title: "Review evidence decision",
              subject_ref: { subject_type: "evidence", subject_id: "evidence.test" },
              reason: "Human review is required.",
              recommended_actions: ["Review evidence decision."],
              next_commands: [],
              requires_human: true,
              protected_action: false,
              safe_handling: {
                auto_execute_allowed: false,
                required_actor: "attorney_or_owner",
                receipt_required: false,
                decision_required: true,
                draft_only: true,
              },
              source_refs: [],
            },
          ],
        }, null, 2)}\n`,
        "utf8",
      );

      const application = await runControlPlaneHumanGateReceiptApplication({
        validationPath,
        humanGatesPath,
        outDir: path.join(root, "application"),
        runAt: "2026-05-23T13:26:00.000Z",
      });
      const schema = JSON.parse(await readFile("schemas/control-plane-human-gate-receipt-application.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(application, schema, {}, "control_plane_human_gate_receipt_application_ready"), []);
      assert.equal(application.application_status, "applied");
      assert.equal(application.protected_actions_executed, false);
      assert.equal(application.summary.applied_receipt_count, 1);
      assert.equal(application.summary.evidence_decision_applied_count, 1);
      assert.equal(application.applied_receipts[0].safe_handling.auto_execute_allowed, false);
      assert.equal(application.patched_gate_items[0].status, "closed");
      assert.equal(application.patched_gate_items[0].protected_action_executed, false);
      assert.equal(application.audit_events[0].type, "human_gate.receipt.applied");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("applies validated control plane work packet receipts", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "hermes-work-packet-application-"));
    try {
      const validationPath = path.join(root, "validation.json");
      const workPacketsPath = path.join(root, "work-packets.json");
      await writeFile(
        validationPath,
        `${JSON.stringify({
          schema_version: "control-plane-work-packet-receipt-validation.v1",
          generated_at: "2026-05-23T06:45:00.000Z",
          validation_id: "control-plane-work-packet-receipt-validation.test",
          validation_status: "ready_to_apply",
          summary: {
            error_count: 0,
            ready_to_apply_count: 1,
            pending_receipt_count: 0,
            invalid_receipt_count: 0,
          },
          validation_items: [],
          receipt_errors: [],
          validated_receipts_to_apply: {
            schema_version: "control-plane-work-packet-receipts-input.v1",
            generated_at: "2026-05-23T06:45:00.000Z",
            work_packet_run_id: "control-plane-work-packets.test",
            instructions: "Test ready receipt.",
            receipts: [
              {
                receipt_id: "work-packet-receipt.test",
                work_packet_id: "work-packet.test",
                packet_type: "stage_recheck",
                source_stage: "control_plane_pipeline",
                receipt_status: "resolved",
                resolved_by: "codex",
                resolved_at: "2026-05-23T06:46:00.000Z",
                resolution_reference: "npm test",
                reviewer: "jws",
                protected_action_reference: null,
                command_result: "passed",
                completed_work_item_ids: ["work-item.test"],
              },
            ],
          },
        }, null, 2)}\n`,
        "utf8",
      );
      await writeFile(
        workPacketsPath,
        `${JSON.stringify({
          schema_version: "control-plane-work-packets.v1",
          generated_at: "2026-05-23T06:44:00.000Z",
          work_packet_run_id: "control-plane-work-packets.test",
          packet_status: "blocked",
          summary: {
            work_packet_count: 1,
            work_item_count: 1,
          },
          work_packets: [
            {
              work_packet_id: "work-packet.test",
              packet_type: "stage_recheck",
              source_stage: "control_plane_pipeline",
              status: "blocked",
              priority: "high",
            },
          ],
          work_items: [
            {
              work_item_id: "work-item.test",
              work_packet_id: "work-packet.test",
              plan_item_id: "plan-item.test",
              source_stage: "control_plane_pipeline",
              status: "blocked",
              priority: "high",
            },
          ],
        }, null, 2)}\n`,
        "utf8",
      );

      const application = await runControlPlaneWorkPacketReceiptApplication({
        validationPath,
        workPacketsPath,
        outDir: path.join(root, "application"),
        runAt: "2026-05-23T06:47:00.000Z",
      });
      const schema = JSON.parse(await readFile("schemas/control-plane-work-packet-receipt-application.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(application, schema, {}, "control_plane_work_packet_receipt_application_ready"), []);
      assert.equal(application.application_status, "applied");
      assert.equal(application.safe_to_apply, true);
      assert.equal(application.summary.applied_receipt_count, 1);
      assert.equal(application.summary.patched_work_packet_count, 1);
      assert.equal(application.summary.patched_work_item_count, 1);
      assert.equal(application.patched_work_packets[0].status, "closed");
      assert.equal(application.patched_work_items[0].status, "completed");
      assert.equal(application.audit_events[0].type, "work_packet.receipt.applied");
      assert.match(await readFile(path.join(root, "application", "summary.md"), "utf8"), /Applied receipts: 1/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("validates the event ledger against schema and run references", async () => {
    const result = await validateEventLedgerFile("examples/core/event-ledger.json");
    assert.deepEqual(result.errors, []);
    assert.equal(result.valid, true);
  });

  it("validates runtime adapters against schema, policy, and capability bindings", async () => {
    const result = await validateRuntimeAdapterRegistryFile("examples/core/runtime-adapters.json");
    assert.deepEqual(result.errors, []);
    assert.equal(result.valid, true);
  });

  it("runs the first file-to-approval vertical slice", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "hermes-vertical-slice-"));
    try {
      const result = await runVerticalSlice({
        inputPath: "examples/core/sample-board-minutes.md",
        outDir,
        runAt: "2026-05-23T00:00:00.000Z",
      });
      const schemas = await loadCoreSchemas();
      const sliceValidation = validateVerticalSlice(result.vertical_slice, schemas);
      const ledgerValidation = validateEventLedger(result.event_ledger, schemas, result.vertical_slice);

      assert.equal(result.validation.valid, true);
      assert.deepEqual(sliceValidation.errors, []);
      assert.deepEqual(ledgerValidation.errors, []);
      assert.match(result.output_markdown, /신규 차입 승인/);
      assert.equal(result.summary.status, "blocked");
      assert.equal(result.vertical_slice.governance_output.approvals[0].approval_status, "pending");
      assert.equal(result.vertical_slice.governance_output.gate_results[0].status, "passed");
      assert.equal(result.vertical_slice.governance_output.gate_results[1].blocking, true);
      assert.match(await readFile(path.join(outDir, "output.md"), "utf8"), /Human approval: pending/);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("runs the personal dev Claude/Codex planning slice", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "hermes-personal-dev-slice-"));
    try {
      const result = await runPersonalDevSlice({
        inputPath: "examples/dev-projects.json",
        outDir,
        runAt: "2026-05-23T01:00:00.000Z",
        today: "2026-05-23",
      });
      const schemas = await loadCoreSchemas();
      const sliceValidation = validateVerticalSlice(result.personal_dev_slice, schemas);
      const ledgerValidation = validateEventLedger(result.event_ledger, schemas, result.personal_dev_slice);

      assert.equal(result.validation.valid, true);
      assert.deepEqual(sliceValidation.errors, []);
      assert.deepEqual(ledgerValidation.errors, []);
      assert.equal(result.summary.status, "blocked");
      assert.equal(result.summary.blocked_reason, "merge_approval_pending");
      assert.ok(["git_worktree", "isolated_workspace"].includes(result.summary.actual_isolation));
      assert.equal(result.plan.claude_plan.agent, "claude_code");
      assert.equal(result.plan.codex_plan.agent, "codex");
      assert.equal(result.runtime_invocations.invocations.length, 2);
      assert.deepEqual(
        result.runtime_invocations.invocations.map((item) => item.status),
        ["planned", "planned"],
      );
      assert.equal(result.test_result.status, "passed");
      assert.match(result.pr_draft, /Merge approval: pending human approval/);
      assert.match(await readFile(path.join(outDir, "pr-draft.md"), "utf8"), /Claude Review Plan/);
      assert.match(await readFile(path.join(outDir, "runtime-invocations.json"), "utf8"), /claude_code/);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("prepares an isolated workspace fallback outside git repositories", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "hermes-worktree-fallback-"));
    try {
      const repoPath = path.join(root, "plain-folder");
      const outDir = path.join(root, "out");
      await mkdir(repoPath, { recursive: true });
      const manifest = await prepareAgentWorkspace({
        repoPath,
        outDir,
        projectId: "PLAIN",
        taskId: "PLAIN-001",
      });

      assert.equal(manifest.requested_isolation, "git_worktree");
      assert.equal(manifest.actual_isolation, "isolated_workspace");
      assert.equal(manifest.fallback_reason, "source repository is not a git repository");
      assert.match(manifest.workspace_path, /workspace$/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("creates a git worktree when the source is a git repository", async () => {
    const gitVersion = spawnSync("git", ["--version"], { encoding: "utf8" });
    if (gitVersion.status !== 0) return;

    const root = await mkdtemp(path.join(tmpdir(), "hermes-worktree-git-"));
    try {
      const repoPath = path.join(root, "repo");
      const outDir = path.join(root, "out");
      await mkdir(repoPath, { recursive: true });
      runGit(repoPath, ["init"]);
      runGit(repoPath, ["config", "user.email", "codex@example.local"]);
      runGit(repoPath, ["config", "user.name", "Codex Test"]);
      await writeFile(path.join(repoPath, "README.md"), "# Worktree Test\n", "utf8");
      runGit(repoPath, ["add", "README.md"]);
      runGit(repoPath, ["commit", "-m", "initial"]);

      const manifest = await prepareAgentWorkspace({
        repoPath,
        outDir,
        worktreeRoot: path.join(root, "worktrees"),
        projectId: "HERMES",
        taskId: "WT-001",
        branchName: "codex/wt-001-hermes",
      });

      assert.equal(manifest.actual_isolation, "git_worktree");
      assert.equal(manifest.created, true);
      assert.equal(manifest.branch_name, "codex/wt-001-hermes");
      assert.match(await readFile(path.join(manifest.workspace_path, "README.md"), "utf8"), /Worktree Test/);

      const reused = await prepareAgentWorkspace({
        repoPath,
        outDir: path.join(root, "out-reuse"),
        worktreeRoot: path.join(root, "other-worktrees"),
        projectId: "HERMES",
        taskId: "WT-001",
        branchName: "codex/wt-001-hermes",
      });

      assert.equal(reused.actual_isolation, "git_worktree");
      assert.equal(reused.created, false);
      assert.equal(reused.reused_existing_path, true);
      assert.equal(await realpath(reused.workspace_path), await realpath(manifest.workspace_path));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("records runtime dry-runs without calling external agents", async () => {
    const record = await invokeRuntimeAdapter({
      runtimeId: "codex",
      mode: "dry-run",
      prompt: "Plan a bounded patch",
      workspaceManifest: {
        requested_isolation: "git_worktree",
        actual_isolation: "isolated_workspace",
        workspace_path: "/tmp/hermes-test",
        branch_name: "codex/test",
      },
      runAt: "2026-05-23T03:00:00.000Z",
    });

    assert.equal(record.runtime_id, "codex");
    assert.equal(record.mode, "dry-run");
    assert.equal(record.status, "planned");
    assert.equal(record.blocked_reason, null);
    assert.equal(record.policy.output_trust, "untrusted_until_verified");
  });

  it("blocks Codex execute mode outside git worktree isolation", async () => {
    const record = await invokeRuntimeAdapter({
      runtimeId: "codex",
      mode: "execute",
      command: {
        command: process.execPath,
        args: ["-e", "console.log('should not run')"],
      },
      prompt: "Try to execute Codex outside a git worktree",
      workspaceManifest: {
        requested_isolation: "git_worktree",
        actual_isolation: "isolated_workspace",
        workspace_path: "/tmp/hermes-test",
        branch_name: "codex/test",
      },
      runAt: "2026-05-23T03:00:00.000Z",
    });

    assert.equal(record.status, "blocked");
    assert.match(record.blocked_reason, /requires git_worktree isolation/);
  });

  it("executes local_script runtime commands with captured output", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "hermes-runtime-exec-"));
    try {
      const record = await invokeRuntimeAdapter({
        runtimeId: "local_script",
        mode: "execute",
        command: {
          command: process.execPath,
          args: ["-e", "console.log('runtime ok')"],
        },
        prompt: "Run a deterministic local check",
        workspaceManifest: {
          requested_isolation: "temp_dir",
          actual_isolation: "isolated_workspace",
          workspace_path: root,
        },
        runAt: "2026-05-23T03:00:00.000Z",
      });

      assert.equal(record.status, "completed");
      assert.equal(record.exit_code, 0);
      assert.match(record.output.stdout_preview, /runtime ok/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("records unavailable runtime command bindings without executing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "hermes-runtime-binding-"));
    try {
      const bindingPath = path.join(root, "bindings.json");
      await writeFile(
        bindingPath,
        JSON.stringify(
          {
            schema_version: "runtime-command-bindings.v1",
            binding_registry_id: "runtime.command_bindings.test.v1",
            version: "0.1.0",
            generated_at: "2026-05-23T04:10:00.000Z",
            bindings: [
              {
                runtime_id: "codex",
                binding_id: "binding.codex.missing.test",
                display_name: "Missing Codex",
                candidate_commands: [{ command: "__missing_codex_command_for_test__", args: [] }],
                prompt_delivery: "stdin",
                execute_requires_git_worktree: true,
                install_hint: "Install Codex CLI for this test binding.",
                metadata: {},
              },
            ],
            metadata: {},
          },
          null,
          2,
        ),
        "utf8",
      );

      const inspection = await inspectRuntimeCommandBindings({ commandBindingPath: bindingPath });
      assert.equal(inspection.bindings[0].status, "unavailable");

      const record = await invokeRuntimeAdapter({
        runtimeId: "codex",
        mode: "execute",
        prompt: "Try missing Codex binding",
        commandBindingPath: bindingPath,
        workspaceManifest: {
          requested_isolation: "git_worktree",
          actual_isolation: "git_worktree",
          workspace_path: root,
          branch_name: "codex/test",
        },
        runAt: "2026-05-23T04:10:00.000Z",
      });
      assert.equal(record.status, "unavailable");
      assert.equal(record.binding.status, "unavailable");
      assert.match(record.binding.install_hint, /Install Codex CLI/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function runGit(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, `git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result;
}
