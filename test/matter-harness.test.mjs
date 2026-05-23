import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runControlPlanePipeline } from "../src/control-plane-pipeline.mjs";
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
import { runLawFirmLddSlice } from "../src/law-firm-ldd-slice-runner.mjs";
import { runMatterCockpit } from "../src/matter-cockpit.mjs";
import { runObservabilityCatalog } from "../src/observability-catalog.mjs";
import { runOutputArtifactCatalog } from "../src/output-artifact-catalog.mjs";
import { runPostDeliveryReconciliation } from "../src/post-delivery-reconciliation.mjs";
import { runProtectedDeliveryQueue } from "../src/protected-delivery-queue.mjs";
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
import { extractTextFromOfficeXml, inferResourceSignals } from "../src/resource-extract.mjs";
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

  it("extracts text from office xml and classifies resource signals", () => {
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

      const dashboard = await runReviewDashboard({
        resourceExpansionPath: path.join(outDir, "resource-expansion-job.json"),
        resourceIngestPath: path.join(outDir, "ingest", "resource-ingest.json"),
        evidenceViewerPath: path.join(outDir, "viewer", "evidence-viewer.json"),
        approvalQueuePath: path.join(outDir, "approval-queue", "approval-queue.json"),
        approvalDecisionPath: path.join(outDir, "approval-decisions", "approval-decision-result.json"),
        approvalInboxPath: path.join(outDir, "approval-inbox", "approval-inbox.json"),
        approvalInboxDecisionPath: path.join(outDir, "approval-inbox-decisions", "approval-inbox-decision-result.json"),
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
        lawFirmLddSummaryPath: path.join(outDir, "law-firm-ldd", "summary.json"),
        personalDevSummaryPath: path.join(outDir, "personal-dev", "summary.json"),
        creativeDocumentSummaryPath: path.join(outDir, "creative-document", "summary.json"),
        outDir: path.join(outDir, "dashboard"),
        runAt: "2026-05-23T06:35:00.000Z",
      });
      const dashboardSchema = JSON.parse(await readFile("schemas/review-dashboard.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(dashboard, dashboardSchema, {}, "review_dashboard"), []);
      assert.equal(dashboard.summary.overall_status, "blocked");
      assert.equal(dashboard.summary.evidence_approved_count, 1);
      assert.equal(dashboard.summary.pending_approval_count, 3);
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
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "approval_inbox"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "approval_inbox_decisions"));
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
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/packs"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/capabilities"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/artifacts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/runs"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/events"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/costs"));
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

      const apiDashboard = JSON.parse((await buildReviewApiResponse("/api/dashboard", apiOptions)).body);
      assert.equal(apiDashboard.schema_version, "review-dashboard.v1");
      assert.equal(apiDashboard.summary.overall_status, "blocked");

      const highActions = JSON.parse((await buildReviewApiResponse("/api/actions?priority=high", apiOptions)).body);
      assert.equal(highActions.collection, "action_items");
      assert.ok(highActions.items.length >= 1);
      assert.ok(highActions.items.every((item) => item.priority === "high"));

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
