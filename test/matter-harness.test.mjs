import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runControlPlaneAuditTrail } from "../src/control-plane-audit-trail.mjs";
import { runControlPlaneActionPlan } from "../src/control-plane-action-plan.mjs";
import { runContractDependencyMap } from "../src/contract-dependency-map.mjs";
import { runContractGoldenFixtures } from "../src/contract-golden-fixtures.mjs";
import { runContractValidationSuite } from "../src/contract-validation-suite.mjs";
import { runContractInventory } from "../src/contract-inventory.mjs";
import { runIdentityModel } from "../src/identity-model.mjs";
import { runClientCounterpartyRegistry } from "../src/client-counterparty-registry.mjs";
import { runMatterProfileTeamLedger } from "../src/matter-profile-team-ledger.mjs";
import { runWallPolicyContract } from "../src/wall-policy-contract.mjs";
import { runMatterAccessPolicyEvaluator } from "../src/matter-access-policy-evaluator.mjs";
import { runDataClassificationRuleEngine } from "../src/data-classification-rule-engine.mjs";
import { runMatterTaggingDecisionLedger } from "../src/matter-tagging-decision-ledger.mjs";
import { runAccessAuditProjection } from "../src/access-audit-projection.mjs";
import { runStorePolicyAdapter } from "../src/store-policy-adapter.mjs";
import { runConflictCheckInterface } from "../src/conflict-check-interface.mjs";
import { runPersonalWorkspaceBoundary } from "../src/personal-workspace-boundary.mjs";
import { runPolicyGoldenFixtures } from "../src/policy-golden-fixtures.mjs";
import { runPolicyOperationsSurface } from "../src/policy-operations-surface.mjs";
import { runMatterBoundarySlice } from "../src/matter-boundary-slice.mjs";
import { runIdentityPolicyMatterFreeze } from "../src/identity-policy-matter-freeze.mjs";
import { runResourceStoreInterface } from "../src/resource-store-interface.mjs";
import { runImmutableObjectStoreLayout } from "../src/immutable-object-store-layout.mjs";
import { runResourceVersionLedger } from "../src/resource-version-ledger.mjs";
import { runNormalizedTextContract } from "../src/normalized-text-contract.mjs";
import { runExtractorAdapterContract } from "../src/extractor-adapter-contract.mjs";
import { runSourceSpanStore } from "../src/source-span-store.mjs";
import { runEvidenceItemStore } from "../src/evidence-item-store.mjs";
import { runFactClaimStore } from "../src/fact-claim-store.mjs";
import { runIssueGraphStore } from "../src/issue-graph-store.mjs";
import { runCitationObjectStore } from "../src/citation-object-store.mjs";
import { runLineageGraphBuilder } from "../src/lineage-graph-builder.mjs";
import { runEvidenceCoverageScore } from "../src/evidence-coverage-score.mjs";
import { runEvidenceFlags } from "../src/evidence-flags.mjs";
import { runExhibitMap } from "../src/exhibit-map.mjs";
import { runChainOfCustodyEvents } from "../src/chain-of-custody-events.mjs";
import { runSearchIndexContract } from "../src/search-index-contract.mjs";
import { runModelPolicyEnforcement } from "../src/model-policy-enforcement.mjs";
import { runToolRuntimePolicyEnforcement } from "../src/tool-runtime-policy-enforcement.mjs";
import { runOutputDestinationPolicyEnforcement } from "../src/output-destination-policy-enforcement.mjs";
import { runApprovalAuthorityLedger } from "../src/approval-authority-ledger.mjs";
import { runSchemaVersioningRules } from "../src/schema-versioning-rules.mjs";
import { runSchemaMigrationManifest } from "../src/schema-migration-manifest.mjs";
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
import { runHumanReviewCorrectionFeedback } from "../src/human-review-correction-feedback.mjs";
import { runHumanReviewCycleLedger } from "../src/human-review-cycle-ledger.mjs";
import { runHumanReviewCycleWorkOrders } from "../src/human-review-cycle-work-orders.mjs";
import { runHumanReviewCycleWorkOrderTargetAudit } from "../src/human-review-cycle-work-order-target-audit.mjs";
import { runHumanReviewCycleTriageInbox } from "../src/human-review-cycle-triage-inbox.mjs";
import { runHumanReviewCycleReviewerConsole } from "../src/human-review-cycle-reviewer-console.mjs";
import { runHumanReviewCycleReceiptFieldAudit } from "../src/human-review-cycle-receipt-field-audit.mjs";
import { runHumanReviewCycleReceiptCompletionPack } from "../src/human-review-cycle-receipt-completion-pack.mjs";
import { runHumanReviewCycleReceiptCompletionVerification } from "../src/human-review-cycle-receipt-completion-verification.mjs";
import { runHumanReviewCycleReceiptCompletionWorkbench } from "../src/human-review-cycle-receipt-completion-workbench.mjs";
import { runHumanReviewCycleReceiptCompletionRunbook } from "../src/human-review-cycle-receipt-completion-runbook.mjs";
import { runHumanReviewCycleReceiptCompletionReadiness } from "../src/human-review-cycle-receipt-completion-readiness.mjs";
import { runHumanReviewCycleReceiptCompletionCommandQueue } from "../src/human-review-cycle-receipt-completion-command-queue.mjs";
import { runHumanReviewCycleReceiptCompletionCommandReceipts } from "../src/human-review-cycle-receipt-completion-command-receipts.mjs";
import { runHumanReviewCycleReceiptCompletionCommandReceiptValidation } from "../src/human-review-cycle-receipt-completion-command-receipt-validation.mjs";
import { runHumanReviewCycleReceiptCompletionCommandReceiptFeedback } from "../src/human-review-cycle-receipt-completion-command-receipt-feedback.mjs";
import { runHumanReviewCycleReceiptCompletionCommandReceiptWorkspace } from "../src/human-review-cycle-receipt-completion-command-receipt-workspace.mjs";
import { runHumanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge } from "../src/human-review-cycle-receipt-completion-command-receipt-workspace-merge.mjs";
import { runHumanReviewCycleReceiptCompletionCommandReceiptApplication } from "../src/human-review-cycle-receipt-completion-command-receipt-application.mjs";
import { runHumanReviewCycleReceiptCompletionReconciliation } from "../src/human-review-cycle-receipt-completion-reconciliation.mjs";
import { runHumanReviewCycleReceiptCompletionBaseline } from "../src/human-review-cycle-receipt-completion-baseline.mjs";
import { runHumanReviewCycleReceiptCompletionManualCommandReceiptPack } from "../src/human-review-cycle-receipt-completion-manual-command-receipt-pack.mjs";
import { runHumanReviewCycleReceiptCompletionHeldCommandResolution } from "../src/human-review-cycle-receipt-completion-held-command-resolution.mjs";
import { runHumanReviewCycleReceiptCompletionProtectedApprovalRequestPack } from "../src/human-review-cycle-receipt-completion-protected-approval-request-pack.mjs";
import { runHumanReviewCycleReceiptCompletionManualRevalidation } from "../src/human-review-cycle-receipt-completion-manual-revalidation.mjs";
import { runHumanReviewCycleReceiptCompletionCommandQueuePatchProjection } from "../src/human-review-cycle-receipt-completion-command-queue-patch-projection.mjs";
import { runHumanReviewCycleReceiptCompletionCloseoutLedger } from "../src/human-review-cycle-receipt-completion-closeout-ledger.mjs";
import { runHumanReviewV1RegressionFreeze } from "../src/human-review-v1-regression-freeze.mjs";
import { runHumanReviewCorrectionWorkspace } from "../src/human-review-correction-workspace.mjs";
import { runHumanReviewCorrectionWorkspaceMerge } from "../src/human-review-correction-workspace-merge.mjs";
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
import { runPolicySnapshotBindingLedger } from "../src/policy-snapshot-binding-ledger.mjs";
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
import { runResourceContractFreeze } from "../src/resource-contract-freeze.mjs";
import { runMatterContractFreeze } from "../src/matter-contract-freeze.mjs";
import { runPolicyContractFreeze } from "../src/policy-contract-freeze.mjs";
import { runEvidenceContractFreeze } from "../src/evidence-contract-freeze.mjs";
import { runCapabilityWorkflowContractFreeze } from "../src/capability-workflow-contract-freeze.mjs";
import { runRuntimeAgentRunContractFreeze } from "../src/runtime-agentrun-contract-freeze.mjs";
import { runGateApprovalContractFreeze } from "../src/gate-approval-contract-freeze.mjs";
import { runOutputDeliveryContractFreeze } from "../src/output-delivery-contract-freeze.mjs";
import { runEventAuditRunContractFreeze } from "../src/event-audit-run-contract-freeze.mjs";
import { runErrorCostObservabilityContractFreeze } from "../src/error-cost-observability-contract-freeze.mjs";
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

      const resourceContractFreeze = await runResourceContractFreeze({
        resourceIngestPath: path.join(outDir, "ingest", "resource-ingest.json"),
        outDir: path.join(outDir, "resource-contract-freeze"),
        runAt: "2026-05-23T06:12:00.000Z",
      });
      const resourceContractFreezeSchema = JSON.parse(await readFile("schemas/resource-contract-freeze.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(resourceContractFreeze, resourceContractFreezeSchema, {}, "resource_contract_freeze"), []);
      assert.equal(resourceContractFreeze.summary.freeze_status, "complete");
      assert.equal(resourceContractFreeze.summary.resource_count, ingest.summary.promoted_resource_count);
      assert.equal(resourceContractFreeze.summary.resource_version_count, ingest.resource_evidence.resource_versions.length);
      assert.equal(resourceContractFreeze.summary.content_hash_count, resourceContractFreeze.summary.resource_count);
      assert.equal(resourceContractFreeze.summary.external_id_count, resourceContractFreeze.summary.resource_count);
      assert.equal(resourceContractFreeze.summary.classification_count, resourceContractFreeze.summary.resource_count);
      assert.equal(resourceContractFreeze.summary.matter_link_count, resourceContractFreeze.summary.resource_count);
      assert.equal(resourceContractFreeze.summary.latest_version_link_count, resourceContractFreeze.summary.resource_count);
      assert.equal(resourceContractFreeze.summary.validation_error_count, 0);
      assert.equal(resourceContractFreeze.resource_contract.resources[0].schema_version, "resource-core.v2");
      assert.equal(resourceContractFreeze.resource_contract.resource_versions[0].schema_version, "resource-version.v2");
      assert.ok(resourceContractFreeze.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "resource-contract-freeze", "summary.md"), "utf8"), /Resource Contract Freeze/);

      const matterContractFreeze = await runMatterContractFreeze({
        verticalSlicePath: "examples/core/vertical-slice-example.json",
        outDir: path.join(outDir, "matter-contract-freeze"),
        runAt: "2026-05-23T06:13:00.000Z",
      });
      const matterContractFreezeSchema = JSON.parse(await readFile("schemas/matter-contract-freeze.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(matterContractFreeze, matterContractFreezeSchema, {}, "matter_contract_freeze"), []);
      assert.equal(matterContractFreeze.summary.freeze_status, "complete");
      assert.equal(matterContractFreeze.summary.client_count, 1);
      assert.equal(matterContractFreeze.summary.matter_count, 1);
      assert.equal(matterContractFreeze.summary.party_count, 2);
      assert.equal(matterContractFreeze.summary.counterparty_count, 1);
      assert.equal(matterContractFreeze.summary.matter_team_count, 1);
      assert.equal(matterContractFreeze.summary.matter_boundary_count, 1);
      assert.equal(matterContractFreeze.summary.matter_with_client_count, matterContractFreeze.summary.matter_count);
      assert.equal(matterContractFreeze.summary.matter_with_party_count, matterContractFreeze.summary.matter_count);
      assert.equal(matterContractFreeze.summary.matter_with_counterparty_count, matterContractFreeze.summary.matter_count);
      assert.equal(matterContractFreeze.summary.matter_with_team_count, matterContractFreeze.summary.matter_count);
      assert.equal(matterContractFreeze.summary.matter_with_wall_count, matterContractFreeze.summary.matter_count);
      assert.equal(matterContractFreeze.summary.matter_with_policy_snapshot_count, matterContractFreeze.summary.matter_count);
      assert.equal(matterContractFreeze.summary.validation_error_count, 0);
      assert.equal(matterContractFreeze.matter_contract.clients[0].schema_version, "client.v2");
      assert.equal(matterContractFreeze.matter_contract.parties[0].schema_version, "party.v2");
      assert.equal(matterContractFreeze.matter_contract.matters[0].schema_version, "matter-core.v2");
      assert.equal(matterContractFreeze.matter_contract.matter_teams[0].schema_version, "matter-team.v2");
      assert.equal(matterContractFreeze.matter_contract.matter_boundaries[0].schema_version, "matter-boundary.v2");
      assert.ok(matterContractFreeze.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "matter-contract-freeze", "summary.md"), "utf8"), /Matter Contract Freeze/);

      const identityModel = await runIdentityModel({
        verticalSlicePath: "examples/core/vertical-slice-example.json",
        outDir: path.join(outDir, "identity-model"),
        runAt: "2026-05-23T06:13:30.000Z",
      });
      const identityModelSchema = JSON.parse(await readFile("schemas/identity-model.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(identityModel, identityModelSchema, {}, "identity_model"), []);
      assert.equal(identityModel.summary.identity_model_status, "complete");
      assert.equal(identityModel.summary.tenant_count, 1);
      assert.equal(identityModel.summary.user_count, 1);
      assert.equal(identityModel.summary.human_actor_principal_count, 1);
      assert.ok(identityModel.summary.service_actor_principal_count >= 1);
      assert.ok(identityModel.summary.actor_principal_count > identityModel.summary.human_actor_principal_count);
      assert.ok(identityModel.summary.role_assignment_count >= identityModel.summary.user_count);
      assert.equal(identityModel.summary.human_actor_user_binding_count, identityModel.summary.user_count);
      assert.equal(identityModel.summary.validation_error_count, 0);
      assert.ok(identityModel.identity_contract.users.every((user) => user.user_id !== user.human_actor_principal_id));
      assert.ok(identityModel.identity_contract.actor_principals.some((actor) => actor.principal_class === "human_actor" && actor.human_user_id === "user.jws"));
      assert.ok(identityModel.identity_contract.actor_principals.some((actor) => actor.principal_class !== "human_actor" && actor.human_user_id === null));
      assert.ok(identityModel.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "identity-model", "summary.md"), "utf8"), /Identity Model/);

      const clientCounterpartyRegistry = await runClientCounterpartyRegistry({
        matterContractFreezePath: path.join(outDir, "matter-contract-freeze", "matter-contract-freeze.json"),
        outDir: path.join(outDir, "client-counterparty-registry"),
        runAt: "2026-05-23T06:13:45.000Z",
      });
      const clientCounterpartyRegistrySchema = JSON.parse(await readFile("schemas/client-counterparty-registry.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(clientCounterpartyRegistry, clientCounterpartyRegistrySchema, {}, "client_counterparty_registry"), []);
      assert.equal(clientCounterpartyRegistry.summary.registry_status, "complete");
      assert.equal(clientCounterpartyRegistry.summary.source_matter_contract_status, "complete");
      assert.equal(clientCounterpartyRegistry.summary.party_count, matterContractFreeze.summary.party_count);
      assert.equal(clientCounterpartyRegistry.summary.client_count, matterContractFreeze.summary.client_count);
      assert.equal(clientCounterpartyRegistry.summary.counterparty_count, matterContractFreeze.summary.counterparty_count);
      assert.equal(clientCounterpartyRegistry.summary.stable_party_id_count, clientCounterpartyRegistry.summary.party_count);
      assert.equal(clientCounterpartyRegistry.summary.conflict_reference_count, clientCounterpartyRegistry.summary.party_count);
      assert.equal(clientCounterpartyRegistry.summary.matter_party_link_count, matterContractFreeze.matter_contract.matters[0].party_ids.length);
      assert.equal(clientCounterpartyRegistry.summary.matter_with_client_link_count, matterContractFreeze.summary.matter_with_client_count);
      assert.equal(clientCounterpartyRegistry.summary.matter_with_counterparty_link_count, matterContractFreeze.summary.matter_with_counterparty_count);
      assert.equal(clientCounterpartyRegistry.summary.duplicate_alias_count, 0);
      assert.equal(clientCounterpartyRegistry.summary.validation_error_count, 0);
      assert.ok(clientCounterpartyRegistry.registry_contract.client_registry.some((entry) => entry.client_id === "client.alpha"));
      assert.ok(clientCounterpartyRegistry.registry_contract.counterparty_registry.some((entry) => entry.stable_party_id === "party.counterparty.beta_seller"));
      assert.ok(clientCounterpartyRegistry.registry_contract.party_registry.every((entry) => entry.conflict_ref_id));
      assert.ok(clientCounterpartyRegistry.registry_contract.conflict_reference_index.every((entry) => entry.conflict_check_status === "ready"));
      assert.ok(clientCounterpartyRegistry.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "client-counterparty-registry", "summary.md"), "utf8"), /Client\/Counterparty Registry/);

      const matterProfileTeamLedger = await runMatterProfileTeamLedger({
        matterContractFreezePath: path.join(outDir, "matter-contract-freeze", "matter-contract-freeze.json"),
        identityModelPath: path.join(outDir, "identity-model", "identity-model.json"),
        clientCounterpartyRegistryPath: path.join(outDir, "client-counterparty-registry", "client-counterparty-registry.json"),
        outDir: path.join(outDir, "matter-profile-team-ledger"),
        runAt: "2026-05-23T06:13:55.000Z",
      });
      const matterProfileTeamLedgerSchema = JSON.parse(await readFile("schemas/matter-profile-team-ledger.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(matterProfileTeamLedger, matterProfileTeamLedgerSchema, {}, "matter_profile_team_ledger"), []);
      assert.equal(matterProfileTeamLedger.summary.ledger_status, "complete");
      assert.equal(matterProfileTeamLedger.summary.source_matter_contract_status, "complete");
      assert.equal(matterProfileTeamLedger.summary.source_identity_model_status, "complete");
      assert.equal(matterProfileTeamLedger.summary.source_client_counterparty_registry_status, "complete");
      assert.equal(matterProfileTeamLedger.summary.matter_profile_count, matterContractFreeze.summary.matter_count);
      assert.equal(matterProfileTeamLedger.summary.matter_team_roster_count, matterContractFreeze.summary.matter_team_count);
      assert.equal(matterProfileTeamLedger.summary.team_membership_count, matterContractFreeze.summary.team_member_count);
      assert.equal(matterProfileTeamLedger.summary.active_team_membership_count, matterProfileTeamLedger.summary.team_membership_count);
      assert.equal(matterProfileTeamLedger.summary.allowed_access_subject_count, matterProfileTeamLedger.summary.team_membership_count);
      assert.equal(matterProfileTeamLedger.summary.matter_with_team_count, matterContractFreeze.summary.matter_with_team_count);
      assert.equal(matterProfileTeamLedger.summary.matter_with_responsible_partner_count, matterContractFreeze.summary.matter_count);
      assert.equal(matterProfileTeamLedger.summary.team_member_user_count, 1);
      assert.equal(matterProfileTeamLedger.summary.validation_error_count, 0);
      assert.ok(matterProfileTeamLedger.matter_team_contract.matter_profiles.every((profile) => profile.access_scope === "matter_team_only"));
      assert.ok(matterProfileTeamLedger.matter_team_contract.matter_team_memberships.every((membership) => membership.access_decision === "allow"));
      assert.ok(matterProfileTeamLedger.matter_team_contract.matter_access_subjects.every((subject) => subject.access_decision === "allow" ? subject.membership_id : !subject.membership_id));
      assert.ok(matterProfileTeamLedger.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "matter-profile-team-ledger", "summary.md"), "utf8"), /Matter Profile\/Team Ledger/);

      const wallPolicyContract = await runWallPolicyContract({
        matterContractFreezePath: path.join(outDir, "matter-contract-freeze", "matter-contract-freeze.json"),
        clientCounterpartyRegistryPath: path.join(outDir, "client-counterparty-registry", "client-counterparty-registry.json"),
        matterProfileTeamLedgerPath: path.join(outDir, "matter-profile-team-ledger", "matter-profile-team-ledger.json"),
        outDir: path.join(outDir, "wall-policy-contract"),
        runAt: "2026-05-23T06:14:05.000Z",
      });
      const wallPolicyContractSchema = JSON.parse(await readFile("schemas/wall-policy-contract.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(wallPolicyContract, wallPolicyContractSchema, {}, "wall_policy_contract"), []);
      assert.equal(wallPolicyContract.summary.wall_policy_status, "complete");
      assert.equal(wallPolicyContract.summary.source_matter_contract_status, "complete");
      assert.equal(wallPolicyContract.summary.source_client_counterparty_registry_status, "complete");
      assert.equal(wallPolicyContract.summary.source_matter_profile_team_ledger_status, "complete");
      assert.equal(wallPolicyContract.summary.wall_policy_rule_count, matterContractFreeze.summary.matter_with_wall_count);
      assert.equal(wallPolicyContract.summary.active_wall_policy_rule_count, wallPolicyContract.summary.wall_policy_rule_count);
      assert.equal(wallPolicyContract.summary.pre_retrieval_rule_count, wallPolicyContract.summary.wall_policy_rule_count);
      assert.equal(wallPolicyContract.summary.deny_unless_allowed_rule_count, wallPolicyContract.summary.wall_policy_rule_count);
      assert.equal(wallPolicyContract.summary.retrieval_wall_filter_count, wallPolicyContract.summary.wall_policy_rule_count);
      assert.equal(wallPolicyContract.summary.complete_retrieval_wall_filter_count, wallPolicyContract.summary.retrieval_wall_filter_count);
      assert.equal(wallPolicyContract.summary.allowed_wall_subject_binding_count, matterProfileTeamLedger.summary.allowed_access_subject_count);
      assert.equal(wallPolicyContract.summary.conflict_wall_binding_count, matterContractFreeze.matter_contract.matters[0].party_ids.length);
      assert.equal(wallPolicyContract.summary.ready_conflict_wall_binding_count, wallPolicyContract.summary.conflict_wall_binding_count);
      assert.equal(wallPolicyContract.summary.required_filter_key_count, 5);
      assert.equal(wallPolicyContract.summary.validation_error_count, 0);
      assert.ok(wallPolicyContract.wall_policy_contract.wall_policy_rules.every((rule) => rule.enforcement_stage === "pre_retrieval"));
      assert.ok(wallPolicyContract.wall_policy_contract.wall_policy_rules.every((rule) => rule.decision_mode === "deny_unless_allowed"));
      assert.ok(wallPolicyContract.wall_policy_contract.retrieval_wall_filters.every((filter) => filter.required_filter_keys.includes("matter_id")));
      assert.ok(wallPolicyContract.wall_policy_contract.wall_subject_bindings.every((binding) => binding.access_decision === "allow" ? binding.can_retrieve : !binding.can_retrieve));
      assert.ok(wallPolicyContract.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "wall-policy-contract", "summary.md"), "utf8"), /Wall Policy Contract/);

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

      const policyContractFreeze = await runPolicyContractFreeze({
        policyMatrixCatalogPath: path.join(outDir, "policy-matrix", "policy-matrix-catalog.json"),
        policySnapshotLedgerPath: path.join(outDir, "policy-snapshots", "policy-snapshot-ledger.json"),
        resourceContractFreezePath: path.join(outDir, "resource-contract-freeze", "resource-contract-freeze.json"),
        matterContractFreezePath: path.join(outDir, "matter-contract-freeze", "matter-contract-freeze.json"),
        outDir: path.join(outDir, "policy-contract-freeze"),
        runAt: "2026-05-23T06:34:54.000Z",
      });
      const policyContractFreezeSchema = JSON.parse(await readFile("schemas/policy-contract-freeze.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(policyContractFreeze, policyContractFreezeSchema, {}, "policy_contract_freeze"), []);
      assert.equal(policyContractFreeze.summary.freeze_status, "complete");
      assert.equal(policyContractFreeze.summary.classification_count, 6);
      assert.equal(policyContractFreeze.summary.required_classification_count, 6);
      assert.equal(policyContractFreeze.summary.missing_classification_count, 0);
      assert.equal(policyContractFreeze.summary.extra_classification_count, 0);
      assert.equal(policyContractFreeze.summary.runtime_rule_link_count, 6);
      assert.equal(policyContractFreeze.summary.model_rule_link_count, 6);
      assert.equal(policyContractFreeze.summary.resource_policy_reference_count, resourceContractFreeze.summary.resource_count);
      assert.equal(policyContractFreeze.summary.matter_policy_reference_count, matterContractFreeze.summary.matter_count);
      assert.equal(policyContractFreeze.summary.matter_boundary_policy_reference_count, matterContractFreeze.summary.matter_boundary_count);
      assert.equal(policyContractFreeze.summary.unresolved_policy_reference_count, 0);
      assert.equal(policyContractFreeze.summary.validation_error_count, 0);
      assert.equal(policyContractFreeze.policy_contract.data_classifications[0].schema_version, "data-classification.v2");
      assert.equal(policyContractFreeze.policy_contract.policy_references[0].schema_version, "policy-reference.v2");
      assert.equal(policyContractFreeze.policy_contract.policy_decisions[0].schema_version, "policy-decision.v2");
      assert.ok(policyContractFreeze.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "policy-contract-freeze", "summary.md"), "utf8"), /Policy Contract Freeze/);

      const evidenceContractFreeze = await runEvidenceContractFreeze({
        lawFirmSlicePath: path.join(outDir, "law-firm-ldd", "law-firm-ldd-slice.json"),
        resourceContractFreezePath: path.join(outDir, "resource-contract-freeze", "resource-contract-freeze.json"),
        matterContractFreezePath: path.join(outDir, "matter-contract-freeze", "matter-contract-freeze.json"),
        policyContractFreezePath: path.join(outDir, "policy-contract-freeze", "policy-contract-freeze.json"),
        outDir: path.join(outDir, "evidence-contract-freeze"),
        runAt: "2026-05-23T06:34:56.000Z",
      });
      const evidenceContractFreezeSchema = JSON.parse(await readFile("schemas/evidence-contract-freeze.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(evidenceContractFreeze, evidenceContractFreezeSchema, {}, "evidence_contract_freeze"), []);
      assert.equal(evidenceContractFreeze.summary.freeze_status, "complete");
      assert.equal(evidenceContractFreeze.summary.source_span_count, lddSlice.law_firm_slice.resource_evidence.source_spans.length);
      assert.equal(evidenceContractFreeze.summary.evidence_item_count, lddSlice.law_firm_slice.resource_evidence.evidence_items.length);
      assert.equal(evidenceContractFreeze.summary.fact_claim_count, 1);
      assert.equal(evidenceContractFreeze.summary.issue_count, 1);
      assert.equal(evidenceContractFreeze.summary.citation_count, 1);
      assert.equal(evidenceContractFreeze.summary.citation_bound_count, 1);
      assert.equal(evidenceContractFreeze.summary.citation_broken_count, 0);
      assert.equal(evidenceContractFreeze.summary.complete_lineage_path_count, 1);
      assert.equal(evidenceContractFreeze.summary.broken_lineage_path_count, 0);
      assert.equal(evidenceContractFreeze.summary.policy_snapshot_linked_evidence_count, evidenceContractFreeze.summary.evidence_item_count);
      assert.equal(evidenceContractFreeze.summary.validation_error_count, 0);
      assert.equal(evidenceContractFreeze.evidence_contract.source_spans[0].schema_version, "source-span.v2");
      assert.equal(evidenceContractFreeze.evidence_contract.evidence_items[0].schema_version, "evidence-item.v2");
      assert.equal(evidenceContractFreeze.evidence_contract.fact_claims[0].schema_version, "fact-claim.v2");
      assert.equal(evidenceContractFreeze.evidence_contract.issues[0].schema_version, "issue.v2");
      assert.equal(evidenceContractFreeze.evidence_contract.citations[0].schema_version, "citation.v2");
      assert.equal(evidenceContractFreeze.evidence_contract.lineage_edges[0].schema_version, "evidence-lineage-edge.v2");
      assert.ok(evidenceContractFreeze.evidence_contract.lineage_edges.some((edge) => edge.relation === "source_span_supports_evidence"));
      assert.ok(evidenceContractFreeze.evidence_contract.lineage_edges.some((edge) => edge.relation === "issue_cited_by_citation"));
      assert.ok(evidenceContractFreeze.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "evidence-contract-freeze", "summary.md"), "utf8"), /Evidence Contract Freeze/);

      const capabilityWorkflowContractFreeze = await runCapabilityWorkflowContractFreeze({
        domainPackRegistryPath: path.join(outDir, "domain-packs", "domain-pack-registry.json"),
        lawFirmSlicePath: path.join(outDir, "law-firm-ldd", "law-firm-ldd-slice.json"),
        personalDevSlicePath: path.join(outDir, "personal-dev", "personal-dev-slice.json"),
        creativeDocumentSlicePath: path.join(outDir, "creative-document", "creative-document-slice.json"),
        policyContractFreezePath: path.join(outDir, "policy-contract-freeze", "policy-contract-freeze.json"),
        evidenceContractFreezePath: path.join(outDir, "evidence-contract-freeze", "evidence-contract-freeze.json"),
        outDir: path.join(outDir, "capability-workflow-contract-freeze"),
        runAt: "2026-05-23T06:34:57.000Z",
      });
      const capabilityWorkflowContractFreezeSchema = JSON.parse(await readFile("schemas/capability-workflow-contract-freeze.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(capabilityWorkflowContractFreeze, capabilityWorkflowContractFreezeSchema, {}, "capability_workflow_contract_freeze"), []);
      assert.equal(capabilityWorkflowContractFreeze.summary.freeze_status, "complete");
      assert.equal(capabilityWorkflowContractFreeze.summary.capability_manifest_count, domainPackRegistry.summary.capability_count);
      assert.equal(capabilityWorkflowContractFreeze.summary.workflow_count, 3);
      assert.equal(capabilityWorkflowContractFreeze.summary.workflow_run_count, 3);
      assert.equal(capabilityWorkflowContractFreeze.summary.agent_run_count, 6);
      assert.equal(capabilityWorkflowContractFreeze.summary.capability_with_input_output_count, domainPackRegistry.summary.capability_count);
      assert.equal(capabilityWorkflowContractFreeze.summary.capability_with_gate_contract_count, domainPackRegistry.summary.capability_count);
      assert.equal(capabilityWorkflowContractFreeze.summary.runtime_binding_blocked_count, 0);
      assert.equal(capabilityWorkflowContractFreeze.summary.validation_error_count, 0);
      assert.equal(capabilityWorkflowContractFreeze.capability_workflow_contract.capability_manifests[0].schema_version, "capability-manifest.v2");
      assert.equal(capabilityWorkflowContractFreeze.capability_workflow_contract.workflows[0].schema_version, "workflow.v2");
      assert.equal(capabilityWorkflowContractFreeze.capability_workflow_contract.workflow_runs[0].schema_version, "workflow-run.v2");
      assert.equal(capabilityWorkflowContractFreeze.capability_workflow_contract.agent_runs[0].schema_version, "agent-run.v2");
      assert.ok(capabilityWorkflowContractFreeze.capability_workflow_contract.capability_io_contracts.every((contract) => contract.input_output_status === "complete"));
      assert.ok(capabilityWorkflowContractFreeze.capability_workflow_contract.gate_runtime_contracts.every((contract) => contract.blocked_runtime_binding_count === 0));
      assert.ok(capabilityWorkflowContractFreeze.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "capability-workflow-contract-freeze", "summary.md"), "utf8"), /Capability\/Workflow Contract Freeze/);

      const runtimeAgentRunContractFreeze = await runRuntimeAgentRunContractFreeze({
        runtimeAdapterRegistryPath: "examples/core/runtime-adapters.json",
        runtimeCommandBindingsPath: "examples/core/runtime-command-bindings.json",
        capabilityWorkflowContractFreezePath: path.join(outDir, "capability-workflow-contract-freeze", "capability-workflow-contract-freeze.json"),
        observabilityCatalogPath: path.join(outDir, "observability", "observability-catalog.json"),
        outputArtifactCatalogPath: path.join(outDir, "output-catalog", "output-catalog.json"),
        outDir: path.join(outDir, "runtime-agentrun-contract-freeze"),
        runAt: "2026-05-23T06:34:58.000Z",
      });
      const runtimeAgentRunContractFreezeSchema = JSON.parse(await readFile("schemas/runtime-agentrun-contract-freeze.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(runtimeAgentRunContractFreeze, runtimeAgentRunContractFreezeSchema, {}, "runtime_agentrun_contract_freeze"), []);
      assert.equal(runtimeAgentRunContractFreeze.summary.freeze_status, "complete");
      assert.equal(runtimeAgentRunContractFreeze.summary.runtime_adapter_count, 9);
      assert.equal(runtimeAgentRunContractFreeze.summary.runtime_execution_contract_count, 9);
      assert.equal(runtimeAgentRunContractFreeze.summary.agent_run_count, capabilityWorkflowContractFreeze.summary.agent_run_count);
      assert.equal(runtimeAgentRunContractFreeze.summary.runtime_output_count, capabilityWorkflowContractFreeze.summary.agent_run_count);
      assert.equal(runtimeAgentRunContractFreeze.summary.runtime_log_count, capabilityWorkflowContractFreeze.summary.agent_run_count);
      assert.equal(runtimeAgentRunContractFreeze.summary.runtime_verification_count, capabilityWorkflowContractFreeze.summary.agent_run_count);
      assert.equal(runtimeAgentRunContractFreeze.summary.risk_declared_count, 9);
      assert.equal(runtimeAgentRunContractFreeze.summary.verification_flag_declared_count, 9);
      assert.equal(runtimeAgentRunContractFreeze.summary.agent_log_bound_count, runtimeAgentRunContractFreeze.summary.log_required_agent_run_count);
      assert.equal(runtimeAgentRunContractFreeze.summary.output_hash_count, runtimeAgentRunContractFreeze.summary.agent_run_count);
      assert.equal(runtimeAgentRunContractFreeze.summary.artifact_capture_bound_count, runtimeAgentRunContractFreeze.summary.artifact_capture_required_agent_run_count);
      assert.equal(runtimeAgentRunContractFreeze.summary.high_risk_agent_run_count, 2);
      assert.equal(runtimeAgentRunContractFreeze.summary.untrusted_output_agent_run_count, 2);
      assert.equal(runtimeAgentRunContractFreeze.summary.validation_error_count, 0);
      assert.equal(runtimeAgentRunContractFreeze.runtime_agentrun_contract.runtime_adapters[0].schema_version, "runtime-adapter.v2");
      assert.equal(runtimeAgentRunContractFreeze.runtime_agentrun_contract.runtime_execution_contracts[0].schema_version, "runtime-execution-contract.v2");
      assert.equal(runtimeAgentRunContractFreeze.runtime_agentrun_contract.agent_runs[0].schema_version, "agent-run-runtime.v2");
      assert.equal(runtimeAgentRunContractFreeze.runtime_agentrun_contract.runtime_outputs[0].schema_version, "runtime-output-contract.v2");
      assert.equal(runtimeAgentRunContractFreeze.runtime_agentrun_contract.runtime_logs[0].schema_version, "runtime-log-contract.v2");
      assert.equal(runtimeAgentRunContractFreeze.runtime_agentrun_contract.runtime_verifications[0].schema_version, "runtime-verification-contract.v2");
      assert.ok(runtimeAgentRunContractFreeze.runtime_agentrun_contract.runtime_artifacts.some((artifact) => artifact.artifact_type === "pr_draft"));
      assert.ok(runtimeAgentRunContractFreeze.runtime_agentrun_contract.agent_runs.every((agentRun) => agentRun.output_hash));
      assert.ok(runtimeAgentRunContractFreeze.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "runtime-agentrun-contract-freeze", "summary.md"), "utf8"), /Runtime\/AgentRun Contract Freeze/);

      const matterAccessPolicyEvaluator = await runMatterAccessPolicyEvaluator({
        resourceContractFreezePath: path.join(outDir, "resource-contract-freeze", "resource-contract-freeze.json"),
        runtimeAgentRunContractFreezePath: path.join(outDir, "runtime-agentrun-contract-freeze", "runtime-agentrun-contract-freeze.json"),
        matterProfileTeamLedgerPath: path.join(outDir, "matter-profile-team-ledger", "matter-profile-team-ledger.json"),
        wallPolicyContractPath: path.join(outDir, "wall-policy-contract", "wall-policy-contract.json"),
        outDir: path.join(outDir, "matter-access-policy"),
        runAt: "2026-05-23T06:34:58.500Z",
      });
      const matterAccessPolicyEvaluatorSchema = JSON.parse(await readFile("schemas/matter-access-policy-evaluator.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(matterAccessPolicyEvaluator, matterAccessPolicyEvaluatorSchema, {}, "matter_access_policy_evaluator"), []);
      assert.equal(matterAccessPolicyEvaluator.summary.access_policy_status, "complete");
      assert.equal(matterAccessPolicyEvaluator.summary.source_resource_contract_status, "complete");
      assert.equal(matterAccessPolicyEvaluator.summary.source_runtime_contract_status, "complete");
      assert.equal(matterAccessPolicyEvaluator.summary.source_matter_profile_team_ledger_status, "complete");
      assert.equal(matterAccessPolicyEvaluator.summary.source_wall_policy_contract_status, "complete");
      assert.equal(matterAccessPolicyEvaluator.summary.access_policy_rule_count, wallPolicyContract.summary.wall_policy_rule_count);
      assert.equal(matterAccessPolicyEvaluator.summary.runtime_count, runtimeAgentRunContractFreeze.summary.runtime_adapter_count);
      assert.equal(matterAccessPolicyEvaluator.summary.access_subject_count, matterProfileTeamLedger.summary.matter_access_subject_count);
      assert.equal(matterAccessPolicyEvaluator.summary.matter_access_decision_count, runtimeAgentRunContractFreeze.summary.runtime_adapter_count * matterProfileTeamLedger.summary.matter_access_subject_count);
      assert.equal(matterAccessPolicyEvaluator.summary.resource_access_decision_count, matterAccessPolicyEvaluator.summary.matter_access_decision_count * resourceContractFreeze.summary.resource_count);
      assert.equal(matterAccessPolicyEvaluator.summary.runtime_access_matrix_count, runtimeAgentRunContractFreeze.summary.runtime_adapter_count * wallPolicyContract.summary.wall_policy_rule_count);
      assert.ok(matterAccessPolicyEvaluator.summary.matter_allow_decision_count > 0);
      assert.ok(matterAccessPolicyEvaluator.summary.matter_review_decision_count > 0);
      assert.ok(matterAccessPolicyEvaluator.summary.matter_deny_decision_count > 0);
      assert.equal(matterAccessPolicyEvaluator.summary.resource_allow_decision_count, 0);
      assert.equal(matterAccessPolicyEvaluator.summary.unassigned_resource_review_count, matterAccessPolicyEvaluator.summary.resource_access_decision_count);
      assert.equal(matterAccessPolicyEvaluator.summary.validation_error_count, 0);
      assert.ok(matterAccessPolicyEvaluator.matter_access_policy.matter_access_decisions.every((decision) => ["allow", "deny", "review"].includes(decision.access_decision)));
      assert.ok(matterAccessPolicyEvaluator.matter_access_policy.resource_access_decisions.every((decision) => decision.access_decision !== "allow"));
      assert.ok(matterAccessPolicyEvaluator.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "matter-access-policy", "summary.md"), "utf8"), /Matter Access Policy Evaluator/);

      const dataClassificationRuleEngine = await runDataClassificationRuleEngine({
        resourceContractFreezePath: path.join(outDir, "resource-contract-freeze", "resource-contract-freeze.json"),
        policyContractFreezePath: path.join(outDir, "policy-contract-freeze", "policy-contract-freeze.json"),
        matterAccessPolicyEvaluatorPath: path.join(outDir, "matter-access-policy", "matter-access-policy-evaluator.json"),
        outDir: path.join(outDir, "data-classification-rules"),
        runAt: "2026-05-23T06:34:58.750Z",
      });
      const dataClassificationRuleEngineSchema = JSON.parse(await readFile("schemas/data-classification-rule-engine.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(dataClassificationRuleEngine, dataClassificationRuleEngineSchema, {}, "data_classification_rule_engine"), []);
      assert.equal(dataClassificationRuleEngine.summary.classification_rule_engine_status, "complete");
      assert.equal(dataClassificationRuleEngine.summary.source_resource_contract_status, "complete");
      assert.equal(dataClassificationRuleEngine.summary.source_policy_contract_status, "complete");
      assert.equal(dataClassificationRuleEngine.summary.source_matter_access_policy_status, "complete");
      assert.equal(dataClassificationRuleEngine.summary.classification_rule_count, policyContractFreeze.summary.classification_count);
      assert.equal(dataClassificationRuleEngine.summary.resource_classification_decision_count, resourceContractFreeze.summary.resource_count);
      assert.equal(dataClassificationRuleEngine.summary.classification_policy_binding_count, policyContractFreeze.summary.classification_count);
      assert.equal(dataClassificationRuleEngine.summary.policy_bound_resource_count, resourceContractFreeze.summary.resource_count);
      assert.equal(dataClassificationRuleEngine.summary.unbound_resource_count, 0);
      assert.equal(dataClassificationRuleEngine.summary.review_decision_count, resourceContractFreeze.summary.resource_count);
      assert.equal(dataClassificationRuleEngine.summary.matter_tagging_review_count, resourceContractFreeze.summary.resource_count);
      assert.equal(dataClassificationRuleEngine.summary.matter_access_link_count, matterAccessPolicyEvaluator.summary.resource_access_decision_count);
      assert.equal(dataClassificationRuleEngine.summary.validation_error_count, 0);
      assert.ok(dataClassificationRuleEngine.classification_rule_catalog.classification_rules.every((rule) => rule.policy_decision_id));
      assert.ok(dataClassificationRuleEngine.classification_rule_catalog.resource_classification_decisions.every((decision) => decision.policy_reference_status === "resolved"));
      assert.ok(dataClassificationRuleEngine.classification_rule_catalog.resource_classification_decisions.every((decision) => decision.resource_policy_decision === "review"));
      assert.ok(dataClassificationRuleEngine.classification_rule_catalog.classification_rules.some((rule) => rule.external_model_decision === "review"));
      assert.equal(
        dataClassificationRuleEngine.summary.external_model_allow_count
          + dataClassificationRuleEngine.summary.external_model_review_count
          + dataClassificationRuleEngine.summary.external_model_deny_count,
        resourceContractFreeze.summary.resource_count,
      );
      assert.ok(dataClassificationRuleEngine.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "data-classification-rules", "summary.md"), "utf8"), /Data Classification Rule Engine/);

      const matterTaggingDecisionLedger = await runMatterTaggingDecisionLedger({
        resourceContractFreezePath: path.join(outDir, "resource-contract-freeze", "resource-contract-freeze.json"),
        matterProfileTeamLedgerPath: path.join(outDir, "matter-profile-team-ledger", "matter-profile-team-ledger.json"),
        matterAccessPolicyEvaluatorPath: path.join(outDir, "matter-access-policy", "matter-access-policy-evaluator.json"),
        dataClassificationRuleEnginePath: path.join(outDir, "data-classification-rules", "data-classification-rule-engine.json"),
        outDir: path.join(outDir, "matter-tagging"),
        runAt: "2026-05-23T06:35:04.975Z",
      });
      const matterTaggingDecisionLedgerSchema = JSON.parse(await readFile("schemas/matter-tagging-decision-ledger.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(matterTaggingDecisionLedger, matterTaggingDecisionLedgerSchema, {}, "matter_tagging_decision_ledger"), []);
      assert.equal(matterTaggingDecisionLedger.summary.matter_tagging_ledger_status, "complete");
      assert.equal(matterTaggingDecisionLedger.summary.source_resource_contract_status, "complete");
      assert.equal(matterTaggingDecisionLedger.summary.source_matter_profile_team_ledger_status, "complete");
      assert.equal(matterTaggingDecisionLedger.summary.source_matter_access_policy_status, "complete");
      assert.equal(matterTaggingDecisionLedger.summary.source_data_classification_rule_engine_status, "complete");
      assert.equal(matterTaggingDecisionLedger.summary.resource_count, resourceContractFreeze.summary.resource_count);
      assert.equal(matterTaggingDecisionLedger.summary.matter_tagging_decision_count, resourceContractFreeze.summary.resource_count);
      assert.equal(matterTaggingDecisionLedger.summary.automatic_candidate_count, resourceContractFreeze.summary.resource_count);
      assert.equal(matterTaggingDecisionLedger.summary.pending_human_confirmation_count, resourceContractFreeze.summary.resource_count);
      assert.equal(matterTaggingDecisionLedger.summary.human_confirmation_request_count, matterTaggingDecisionLedger.summary.pending_human_confirmation_count);
      assert.equal(matterTaggingDecisionLedger.summary.correction_history_count, 0);
      assert.equal(matterTaggingDecisionLedger.summary.auto_applied_count, 0);
      assert.equal(matterTaggingDecisionLedger.summary.no_candidate_count, 0);
      assert.equal(matterTaggingDecisionLedger.summary.by_proposed_matter_id["matter.alpha.ldd"], resourceContractFreeze.summary.resource_count);
      assert.equal(matterTaggingDecisionLedger.summary.validation_error_count, 0);
      assert.ok(matterTaggingDecisionLedger.matter_tagging_catalog.matter_tagging_decisions.every((decision) => decision.tagging_status === "pending_human_confirmation"));
      assert.ok(matterTaggingDecisionLedger.matter_tagging_catalog.matter_tagging_decisions.every((decision) => decision.human_confirmation_required === true));
      assert.ok(matterTaggingDecisionLedger.matter_tagging_catalog.matter_tagging_decisions.every((decision) => decision.auto_apply_allowed === false));
      assert.ok(matterTaggingDecisionLedger.matter_tagging_catalog.automatic_tagging_candidates.every((candidate) => candidate.candidate_status === "requires_human_confirmation"));
      assert.ok(matterTaggingDecisionLedger.matter_tagging_catalog.human_confirmation_queue.every((confirmation) => confirmation.confirmation_status === "pending"));
      assert.ok(matterTaggingDecisionLedger.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "matter-tagging", "summary.md"), "utf8"), /Matter Tagging Decision Ledger/);

      const accessAuditProjection = await runAccessAuditProjection({
        matterAccessPolicyEvaluatorPath: path.join(outDir, "matter-access-policy", "matter-access-policy-evaluator.json"),
        matterTaggingDecisionLedgerPath: path.join(outDir, "matter-tagging", "matter-tagging-ledger.json"),
        outDir: path.join(outDir, "access-audit"),
        runAt: "2026-05-23T06:35:05.000Z",
      });
      const accessAuditProjectionSchema = JSON.parse(await readFile("schemas/access-audit-projection.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(accessAuditProjection, accessAuditProjectionSchema, {}, "access_audit_projection"), []);
      assert.equal(accessAuditProjection.summary.access_audit_projection_status, "complete");
      assert.equal(accessAuditProjection.summary.source_matter_access_policy_status, "complete");
      assert.equal(accessAuditProjection.summary.source_matter_tagging_ledger_status, "complete");
      assert.equal(accessAuditProjection.summary.matter_access_decision_count, matterAccessPolicyEvaluator.summary.matter_access_decision_count);
      assert.equal(accessAuditProjection.summary.resource_access_decision_count, matterAccessPolicyEvaluator.summary.resource_access_decision_count);
      assert.equal(accessAuditProjection.summary.access_audit_record_count, matterAccessPolicyEvaluator.summary.matter_access_decision_count + matterAccessPolicyEvaluator.summary.resource_access_decision_count);
      assert.equal(accessAuditProjection.summary.matter_audit_record_count, matterAccessPolicyEvaluator.summary.matter_access_decision_count);
      assert.equal(accessAuditProjection.summary.resource_audit_record_count, matterAccessPolicyEvaluator.summary.resource_access_decision_count);
      assert.equal(accessAuditProjection.summary.actor_access_rollup_count, runtimeAgentRunContractFreeze.summary.runtime_adapter_count);
      assert.equal(accessAuditProjection.summary.resource_access_rollup_count, resourceContractFreeze.summary.resource_count);
      assert.equal(accessAuditProjection.summary.view_allowed_count, matterAccessPolicyEvaluator.summary.allow_decision_count);
      assert.equal(accessAuditProjection.summary.view_requires_human_confirmation_count, matterAccessPolicyEvaluator.summary.review_decision_count);
      assert.equal(accessAuditProjection.summary.view_denied_count, matterAccessPolicyEvaluator.summary.deny_decision_count);
      assert.equal(accessAuditProjection.summary.matter_tagging_linked_count, matterAccessPolicyEvaluator.summary.unassigned_resource_review_count);
      assert.equal(accessAuditProjection.summary.matter_tagging_unresolved_count, 0);
      assert.equal(accessAuditProjection.summary.distinct_user_count, 1);
      assert.equal(accessAuditProjection.summary.distinct_runtime_count, runtimeAgentRunContractFreeze.summary.runtime_adapter_count);
      assert.equal(accessAuditProjection.summary.distinct_matter_count, 1);
      assert.equal(accessAuditProjection.summary.distinct_resource_count, resourceContractFreeze.summary.resource_count);
      assert.equal(accessAuditProjection.summary.validation_error_count, 0);
      assert.ok(accessAuditProjection.access_audit_catalog.access_audit_records.every((record) => record.user_id && record.runtime_id && record.target_matter_id && record.policy_snapshot_id));
      assert.ok(accessAuditProjection.access_audit_catalog.access_audit_records.filter((record) => record.target_type === "resource").every((record) => record.target_resource_id && record.matter_tagging_decision_id));
      assert.ok(accessAuditProjection.access_audit_catalog.actor_access_rollups.every((rollup) => rollup.access_audit_record_count > 0));
      assert.ok(accessAuditProjection.access_audit_catalog.resource_access_rollups.every((rollup) => rollup.matter_tagging_decision_ids.length === 1));
      assert.ok(accessAuditProjection.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "access-audit", "summary.md"), "utf8"), /Access Audit Projection/);

      const storePolicyAdapter = await runStorePolicyAdapter({
        accessAuditProjectionPath: path.join(outDir, "access-audit", "access-audit-projection.json"),
        dataClassificationRuleEnginePath: path.join(outDir, "data-classification-rules", "data-classification-rule-engine.json"),
        outDir: path.join(outDir, "store-policy"),
        runAt: "2026-05-23T06:35:05.125Z",
      });
      const storePolicyAdapterSchema = JSON.parse(await readFile("schemas/store-policy-adapter.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(storePolicyAdapter, storePolicyAdapterSchema, {}, "store_policy_adapter"), []);
      assert.equal(storePolicyAdapter.summary.store_policy_adapter_status, "complete");
      assert.equal(storePolicyAdapter.summary.source_access_audit_projection_status, "complete");
      assert.equal(storePolicyAdapter.summary.source_data_classification_rule_engine_status, "complete");
      assert.equal(storePolicyAdapter.summary.access_audit_record_count, accessAuditProjection.summary.access_audit_record_count);
      assert.equal(storePolicyAdapter.summary.resource_classification_decision_count, dataClassificationRuleEngine.summary.resource_classification_decision_count);
      assert.equal(storePolicyAdapter.summary.store_policy_rule_count, 5);
      assert.equal(storePolicyAdapter.summary.rls_filter_template_count, 5);
      assert.equal(storePolicyAdapter.summary.query_policy_binding_count, accessAuditProjection.summary.access_audit_record_count);
      assert.equal(storePolicyAdapter.summary.store_query_plan_count, accessAuditProjection.summary.access_audit_record_count);
      assert.equal(storePolicyAdapter.summary.enforcement_probe_count, storePolicyAdapter.summary.store_query_plan_count * 6);
      assert.equal(storePolicyAdapter.summary.rls_enforced_query_plan_count, storePolicyAdapter.summary.store_query_plan_count);
      assert.equal(storePolicyAdapter.summary.matter_filter_enforced_count, storePolicyAdapter.summary.store_query_plan_count);
      assert.equal(storePolicyAdapter.summary.classification_filter_enforced_count, storePolicyAdapter.summary.store_query_plan_count);
      assert.equal(storePolicyAdapter.summary.policy_snapshot_filter_enforced_count, storePolicyAdapter.summary.store_query_plan_count);
      assert.equal(storePolicyAdapter.summary.access_audit_filter_enforced_count, storePolicyAdapter.summary.store_query_plan_count);
      assert.equal(storePolicyAdapter.summary.resource_filter_enforced_count, accessAuditProjection.summary.resource_audit_record_count);
      assert.equal(storePolicyAdapter.summary.executable_query_plan_count, accessAuditProjection.summary.can_retrieve_count);
      assert.equal(storePolicyAdapter.summary.held_query_plan_count, accessAuditProjection.summary.view_requires_human_confirmation_count);
      assert.equal(storePolicyAdapter.summary.blocked_query_plan_count, accessAuditProjection.summary.view_denied_count);
      assert.equal(storePolicyAdapter.summary.unfiltered_probe_blocked_count, storePolicyAdapter.summary.store_query_plan_count);
      assert.equal(storePolicyAdapter.summary.cross_matter_probe_blocked_count, storePolicyAdapter.summary.store_query_plan_count);
      assert.equal(storePolicyAdapter.summary.missing_matter_filter_probe_blocked_count, storePolicyAdapter.summary.store_query_plan_count);
      assert.equal(storePolicyAdapter.summary.missing_classification_filter_probe_blocked_count, storePolicyAdapter.summary.store_query_plan_count);
      assert.equal(storePolicyAdapter.summary.missing_policy_snapshot_filter_probe_blocked_count, storePolicyAdapter.summary.store_query_plan_count);
      assert.equal(storePolicyAdapter.summary.validation_error_count, 0);
      assert.ok(storePolicyAdapter.store_policy_catalog.store_query_plans.every((plan) => plan.rls_enforced === true));
      assert.ok(storePolicyAdapter.store_policy_catalog.store_query_plans.every((plan) => plan.required_filter_keys.includes("matter_id") && plan.required_filter_keys.includes("classification")));
      assert.ok(storePolicyAdapter.store_policy_catalog.store_query_plans.filter((plan) => plan.target_type === "resource").every((plan) => plan.required_filter_keys.includes("resource_id")));
      assert.ok(storePolicyAdapter.store_policy_catalog.enforcement_probes.filter((probe) => probe.probe_type === "unfiltered_query").every((probe) => probe.observed_outcome === "blocked"));
      assert.ok(storePolicyAdapter.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "store-policy", "summary.md"), "utf8"), /Store Policy Adapter/);

      const conflictCheckInterface = await runConflictCheckInterface({
        clientCounterpartyRegistryPath: path.join(outDir, "client-counterparty-registry", "client-counterparty-registry.json"),
        matterProfileTeamLedgerPath: path.join(outDir, "matter-profile-team-ledger", "matter-profile-team-ledger.json"),
        wallPolicyContractPath: path.join(outDir, "wall-policy-contract", "wall-policy-contract.json"),
        storePolicyAdapterPath: path.join(outDir, "store-policy", "store-policy-adapter.json"),
        outDir: path.join(outDir, "conflict-check"),
        runAt: "2026-05-23T06:35:05.250Z",
      });
      const conflictCheckInterfaceSchema = JSON.parse(await readFile("schemas/conflict-check-interface.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(conflictCheckInterface, conflictCheckInterfaceSchema, {}, "conflict_check_interface"), []);
      assert.equal(conflictCheckInterface.summary.conflict_check_interface_status, "complete");
      assert.equal(conflictCheckInterface.summary.source_client_counterparty_registry_status, "complete");
      assert.equal(conflictCheckInterface.summary.source_matter_profile_team_ledger_status, "complete");
      assert.equal(conflictCheckInterface.summary.source_wall_policy_contract_status, "complete");
      assert.equal(conflictCheckInterface.summary.source_store_policy_adapter_status, "complete");
      assert.equal(conflictCheckInterface.summary.matter_profile_count, matterProfileTeamLedger.summary.matter_profile_count);
      assert.equal(conflictCheckInterface.summary.protected_resource_count, accessAuditProjection.summary.distinct_resource_count);
      assert.equal(conflictCheckInterface.summary.conflict_reference_count, clientCounterpartyRegistry.summary.conflict_reference_count);
      assert.equal(conflictCheckInterface.summary.conflict_wall_binding_count, wallPolicyContract.summary.conflict_wall_binding_count);
      assert.equal(conflictCheckInterface.summary.store_query_plan_count, storePolicyAdapter.summary.store_query_plan_count);
      assert.equal(conflictCheckInterface.summary.conflict_check_request_count, conflictCheckInterface.summary.matter_intake_request_count + conflictCheckInterface.summary.resource_access_request_count);
      assert.equal(conflictCheckInterface.summary.matter_intake_request_count, matterProfileTeamLedger.summary.matter_profile_count);
      assert.equal(conflictCheckInterface.summary.resource_access_request_count, accessAuditProjection.summary.distinct_resource_count);
      assert.equal(conflictCheckInterface.summary.conflict_check_result_count, conflictCheckInterface.summary.conflict_check_request_count);
      assert.equal(conflictCheckInterface.summary.review_required_result_count, conflictCheckInterface.summary.conflict_check_result_count);
      assert.equal(conflictCheckInterface.summary.blocked_result_count, 0);
      assert.equal(conflictCheckInterface.summary.conflict_signal_count, conflictCheckInterface.summary.conflict_check_request_count * clientCounterpartyRegistry.summary.conflict_reference_count);
      assert.equal(conflictCheckInterface.summary.clear_signal_count, conflictCheckInterface.summary.conflict_check_request_count);
      assert.equal(conflictCheckInterface.summary.review_signal_count, conflictCheckInterface.summary.conflict_check_request_count);
      assert.equal(conflictCheckInterface.summary.block_signal_count, 0);
      assert.equal(conflictCheckInterface.summary.client_signal_count, conflictCheckInterface.summary.conflict_check_request_count);
      assert.equal(conflictCheckInterface.summary.counterparty_signal_count, conflictCheckInterface.summary.conflict_check_request_count);
      assert.equal(conflictCheckInterface.summary.store_plan_linked_request_count, conflictCheckInterface.summary.resource_access_request_count);
      assert.equal(conflictCheckInterface.summary.missing_conflict_reference_count, 0);
      assert.equal(conflictCheckInterface.summary.validation_error_count, 0);
      assert.ok(conflictCheckInterface.conflict_check_catalog.conflict_check_requests.every((request) => request.policy_snapshot_id && request.conflict_ref_ids.length === clientCounterpartyRegistry.summary.conflict_reference_count));
      assert.ok(conflictCheckInterface.conflict_check_catalog.conflict_check_requests.filter((request) => request.request_type === "resource_access").every((request) => request.store_query_plan_ids.length > 0));
      assert.ok(conflictCheckInterface.conflict_check_catalog.conflict_check_results.every((result) => result.result_status === "review_required" && result.final_access_effect === "hold_for_conflict_review"));
      assert.ok(conflictCheckInterface.conflict_check_catalog.conflict_signals.filter((signal) => signal.party_type === "counterparty").every((signal) => signal.signal_decision === "review" && signal.human_review_required === true));
      assert.ok(conflictCheckInterface.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "conflict-check", "summary.md"), "utf8"), /Conflict Check Interface/);

      const personalWorkspaceBoundary = await runPersonalWorkspaceBoundary({
        identityModelPath: path.join(outDir, "identity-model", "identity-model.json"),
        matterProfileTeamLedgerPath: path.join(outDir, "matter-profile-team-ledger", "matter-profile-team-ledger.json"),
        storePolicyAdapterPath: path.join(outDir, "store-policy", "store-policy-adapter.json"),
        conflictCheckInterfacePath: path.join(outDir, "conflict-check", "conflict-check-interface.json"),
        personalDevSlicePath: path.join(outDir, "personal-dev", "personal-dev-slice.json"),
        domainPackRegistryPath: path.join(outDir, "domain-packs", "domain-pack-registry.json"),
        outDir: path.join(outDir, "personal-workspace-boundary"),
        runAt: "2026-05-23T06:35:05.375Z",
      });
      const personalWorkspaceBoundarySchema = JSON.parse(await readFile("schemas/personal-workspace-boundary.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(personalWorkspaceBoundary, personalWorkspaceBoundarySchema, {}, "personal_workspace_boundary"), []);
      assert.equal(personalWorkspaceBoundary.summary.personal_workspace_boundary_status, "complete");
      assert.equal(personalWorkspaceBoundary.summary.workspace_boundary_count, 2);
      assert.equal(personalWorkspaceBoundary.summary.law_firm_boundary_count, 1);
      assert.equal(personalWorkspaceBoundary.summary.personal_workspace_boundary_count, 1);
      assert.equal(personalWorkspaceBoundary.summary.tenant_policy_boundary_count, 2);
      assert.equal(personalWorkspaceBoundary.summary.search_namespace_policy_count, 2);
      assert.equal(personalWorkspaceBoundary.summary.cross_workspace_probe_count, 6);
      assert.equal(personalWorkspaceBoundary.summary.blocked_cross_workspace_probe_count, personalWorkspaceBoundary.summary.cross_workspace_probe_count);
      assert.equal(personalWorkspaceBoundary.summary.allowed_cross_workspace_probe_count, 0);
      assert.equal(personalWorkspaceBoundary.summary.mixed_search_namespace_count, 0);
      assert.equal(personalWorkspaceBoundary.summary.law_firm_tenant_id, "tenant.amic");
      assert.equal(personalWorkspaceBoundary.summary.personal_tenant_id, "tenant.personal.jws");
      assert.equal(personalWorkspaceBoundary.summary.law_firm_resource_count, resourceContractFreeze.summary.resource_count);
      assert.equal(personalWorkspaceBoundary.summary.personal_resource_count, personalDevSlice.personal_dev_slice.resource_evidence.resources.length);
      assert.equal(personalWorkspaceBoundary.summary.law_firm_policy_snapshot_count, 1);
      assert.equal(personalWorkspaceBoundary.summary.personal_policy_snapshot_count, personalDevSlice.personal_dev_slice.identity_policy.policy_snapshots.length);
      assert.equal(personalWorkspaceBoundary.summary.validation_error_count, 0);
      assert.ok(personalWorkspaceBoundary.workspace_boundary_catalog.workspace_boundaries.some((boundary) => boundary.workspace_type === "law_firm_matter" && boundary.tenant_id === "tenant.amic"));
      assert.ok(personalWorkspaceBoundary.workspace_boundary_catalog.workspace_boundaries.some((boundary) => boundary.workspace_type === "personal_project" && boundary.tenant_id === "tenant.personal.jws"));
      assert.ok(personalWorkspaceBoundary.workspace_boundary_catalog.tenant_policy_boundaries.every((boundary) => boundary.denied_tenant_ids.length > 0 && boundary.required_filter_keys.includes("search_namespace_id")));
      assert.ok(personalWorkspaceBoundary.workspace_boundary_catalog.search_namespace_policies.every((policy) => policy.query_scope_status === "isolated" && policy.denied_tenant_ids.length > 0));
      assert.ok(personalWorkspaceBoundary.workspace_boundary_catalog.cross_workspace_probes.every((probe) => probe.observed_outcome === "blocked" && probe.probe_status === "passed"));
      assert.ok(personalWorkspaceBoundary.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "personal-workspace-boundary", "summary.md"), "utf8"), /Personal Workspace Boundary/);

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

      const modelPolicyEnforcement = await runModelPolicyEnforcement({
        dataClassificationRuleEnginePath: path.join(outDir, "data-classification-rules", "data-classification-rule-engine.json"),
        modelRoutingLedgerPath: path.join(outDir, "model-routing", "model-routing-ledger.json"),
        policyContractFreezePath: path.join(outDir, "policy-contract-freeze", "policy-contract-freeze.json"),
        outDir: path.join(outDir, "model-policy-enforcement"),
        runAt: "2026-05-23T06:34:54.250Z",
      });
      const modelPolicyEnforcementSchema = JSON.parse(await readFile("schemas/model-policy-enforcement.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(modelPolicyEnforcement, modelPolicyEnforcementSchema, {}, "model_policy_enforcement"), []);
      assert.equal(modelPolicyEnforcement.summary.model_policy_enforcement_status, "complete");
      assert.equal(modelPolicyEnforcement.summary.source_data_classification_rule_engine_status, "complete");
      assert.equal(modelPolicyEnforcement.summary.source_model_routing_ledger_status, "valid");
      assert.equal(modelPolicyEnforcement.summary.source_policy_contract_status, "complete");
      assert.equal(modelPolicyEnforcement.summary.classification_model_gate_count, dataClassificationRuleEngine.summary.classification_rule_count);
      assert.equal(modelPolicyEnforcement.summary.resource_model_gate_count, dataClassificationRuleEngine.summary.resource_classification_decision_count);
      assert.equal(modelPolicyEnforcement.summary.route_model_gate_count, modelRoutingLedger.summary.routing_decision_count);
      assert.equal(modelPolicyEnforcement.summary.p2_p5_classification_gate_count, 4);
      assert.equal(
        modelPolicyEnforcement.summary.p2_p5_resource_gate_count,
        modelPolicyEnforcement.model_policy_gate_catalog.resource_model_gates.filter((gate) => gate.sensitive_data).length,
      );
      assert.equal(modelPolicyEnforcement.summary.external_transfer_route_count, modelRoutingLedger.summary.external_transfer_count);
      assert.equal(modelPolicyEnforcement.summary.p2_p5_external_transfer_route_count, 0);
      assert.equal(modelPolicyEnforcement.summary.external_transfer_allowed_count, modelRoutingLedger.summary.external_transfer_count);
      assert.equal(modelPolicyEnforcement.summary.unauthorized_external_allow_count, 0);
      assert.equal(modelPolicyEnforcement.summary.validation_error_count, 0);
      assert.ok(modelPolicyEnforcement.model_policy_gate_catalog.classification_model_gates.some((gate) => (
        gate.classification === "P2_CLIENT_CONFIDENTIAL" && gate.gate_status === "requires_approval"
      )));
      assert.ok(modelPolicyEnforcement.model_policy_gate_catalog.classification_model_gates.some((gate) => (
        gate.classification === "P3_PRIVILEGED" && gate.external_model_decision === "deny"
      )));
      assert.ok(modelPolicyEnforcement.model_policy_gate_catalog.resource_model_gates.filter((gate) => gate.sensitive_data).every((gate) => gate.external_transfer_gate_status !== "allowed"));
      assert.ok(modelPolicyEnforcement.model_policy_gate_catalog.route_model_gates.filter((gate) => gate.external_transfer && gate.sensitive_data).every((gate) => gate.gate_decision !== "allow"));
      assert.ok(modelPolicyEnforcement.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "model-policy-enforcement", "summary.md"), "utf8"), /Model Policy Enforcement/);

      const toolRuntimePolicyEnforcement = await runToolRuntimePolicyEnforcement({
        runtimeAgentRunContractFreezePath: path.join(outDir, "runtime-agentrun-contract-freeze", "runtime-agentrun-contract-freeze.json"),
        policyMatrixCatalogPath: path.join(outDir, "policy-matrix", "policy-matrix-catalog.json"),
        capabilityWorkflowContractFreezePath: path.join(outDir, "capability-workflow-contract-freeze", "capability-workflow-contract-freeze.json"),
        modelPolicyEnforcementPath: path.join(outDir, "model-policy-enforcement", "model-policy-enforcement.json"),
        outDir: path.join(outDir, "tool-runtime-policy"),
        runAt: "2026-05-23T06:34:54.375Z",
      });
      const toolRuntimePolicyEnforcementSchema = JSON.parse(await readFile("schemas/tool-runtime-policy-enforcement.schema.json", "utf8"));
      const expectedToolGateCount = runtimeAgentRunContractFreeze.runtime_agentrun_contract.runtime_adapters.reduce((count, runtime) => {
        const toolIds = new Set([
          ...(runtime.tool_policy?.allowed_tools ?? []),
          ...(runtime.tool_policy?.forbidden_tools ?? []),
        ]);
        return count + toolIds.size;
      }, 0);
      assert.deepEqual(validateAgainstSchema(toolRuntimePolicyEnforcement, toolRuntimePolicyEnforcementSchema, {}, "tool_runtime_policy_enforcement"), []);
      assert.equal(toolRuntimePolicyEnforcement.summary.tool_runtime_policy_enforcement_status, "complete");
      assert.equal(toolRuntimePolicyEnforcement.summary.source_runtime_contract_status, "complete");
      assert.equal(toolRuntimePolicyEnforcement.summary.source_policy_matrix_status, "valid");
      assert.equal(toolRuntimePolicyEnforcement.summary.source_capability_workflow_status, "complete");
      assert.equal(toolRuntimePolicyEnforcement.summary.source_model_policy_status, "complete");
      assert.equal(toolRuntimePolicyEnforcement.summary.runtime_policy_gate_count, runtimeAgentRunContractFreeze.summary.runtime_adapter_count * policyMatrixCatalog.summary.runtime_rule_count);
      assert.equal(toolRuntimePolicyEnforcement.summary.tool_permission_gate_count, expectedToolGateCount);
      assert.equal(toolRuntimePolicyEnforcement.summary.agent_run_tool_gate_count, runtimeAgentRunContractFreeze.summary.agent_run_count);
      assert.equal(toolRuntimePolicyEnforcement.summary.unknown_tool_count, 0);
      assert.equal(toolRuntimePolicyEnforcement.summary.tool_overlap_count, 0);
      assert.equal(toolRuntimePolicyEnforcement.summary.missing_tool_permission_gate_count, 0);
      assert.equal(toolRuntimePolicyEnforcement.summary.validation_error_count, 0);
      assert.equal(toolRuntimePolicyEnforcement.summary.forbidden_tool_blocked_count, toolRuntimePolicyEnforcement.summary.forbidden_tool_gate_count);
      assert.ok(toolRuntimePolicyEnforcement.tool_runtime_policy_catalog.tool_permission_gates.filter((gate) => gate.requested_state === "forbidden").every((gate) => gate.gate_decision === "deny"));
      assert.ok(toolRuntimePolicyEnforcement.tool_runtime_policy_catalog.tool_permission_gates.filter((gate) => gate.approval_required).every((gate) => gate.required_gates.includes("human_approval_gate")));
      assert.ok(toolRuntimePolicyEnforcement.tool_runtime_policy_catalog.agent_run_tool_gates.every((gate) => gate.gate_decision !== "deny"));
      assert.ok(toolRuntimePolicyEnforcement.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "tool-runtime-policy", "summary.md"), "utf8"), /Tool\/Runtime Policy Enforcement/);

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
        identityModelPath: path.join(outDir, "identity-model", "identity-model.json"),
        resourceContractFreezePath: path.join(outDir, "resource-contract-freeze", "resource-contract-freeze.json"),
        matterContractFreezePath: path.join(outDir, "matter-contract-freeze", "matter-contract-freeze.json"),
        clientCounterpartyRegistryPath: path.join(outDir, "client-counterparty-registry", "client-counterparty-registry.json"),
        matterProfileTeamLedgerPath: path.join(outDir, "matter-profile-team-ledger", "matter-profile-team-ledger.json"),
        wallPolicyContractPath: path.join(outDir, "wall-policy-contract", "wall-policy-contract.json"),
        matterAccessPolicyEvaluatorPath: path.join(outDir, "matter-access-policy", "matter-access-policy-evaluator.json"),
        evidenceViewerPath: path.join(outDir, "viewer", "evidence-viewer.json"),
        approvalQueuePath: path.join(outDir, "approval-queue", "approval-queue.json"),
        evidenceReviewDraftPath: path.join(outDir, "evidence-review-draft", "evidence-review-draft.json"),
        approvalDecisionPath: path.join(outDir, "approval-decisions", "approval-decision-result.json"),
        approvalInboxPath: path.join(outDir, "approval-inbox", "approval-inbox.json"),
        approvalInboxDecisionPath: path.join(outDir, "approval-inbox-decisions", "approval-inbox-decision-result.json"),
        policyMatrixCatalogPath: path.join(outDir, "policy-matrix", "policy-matrix-catalog.json"),
        policySnapshotLedgerPath: path.join(outDir, "policy-snapshots", "policy-snapshot-ledger.json"),
        policySnapshotBindingLedgerPath: path.join(outDir, "policy-snapshot-bindings", "policy-snapshot-binding-ledger.json"),
        policyContractFreezePath: path.join(outDir, "policy-contract-freeze", "policy-contract-freeze.json"),
        dataClassificationRuleEnginePath: path.join(outDir, "data-classification-rules", "data-classification-rule-engine.json"),
        matterTaggingDecisionLedgerPath: path.join(outDir, "matter-tagging", "matter-tagging-ledger.json"),
        accessAuditProjectionPath: path.join(outDir, "access-audit", "access-audit-projection.json"),
        storePolicyAdapterPath: path.join(outDir, "store-policy", "store-policy-adapter.json"),
        conflictCheckInterfacePath: path.join(outDir, "conflict-check", "conflict-check-interface.json"),
        personalWorkspaceBoundaryPath: path.join(outDir, "personal-workspace-boundary", "personal-workspace-boundary.json"),
        policyGoldenFixturesPath: path.join(outDir, "policy-golden-fixtures", "policy-golden-fixtures.json"),
        policyOperationsSurfacePath: path.join(outDir, "policy-operations-surface", "policy-operations-surface.json"),
        matterBoundarySlicePath: path.join(outDir, "matter-boundary-slice", "matter-boundary-slice.json"),
        identityPolicyMatterFreezePath: path.join(outDir, "identity-policy-matter-freeze", "identity-policy-matter-freeze.json"),
        resourceStoreInterfacePath: path.join(outDir, "resource-store-interface", "resource-store-interface.json"),
        immutableObjectStoreLayoutPath: path.join(outDir, "immutable-object-store-layout", "immutable-object-store-layout.json"),
        resourceVersionLedgerPath: path.join(outDir, "resource-version-ledger", "resource-version-ledger.json"),
        normalizedTextContractPath: path.join(outDir, "normalized-text-contract", "normalized-text-contract.json"),
        extractorAdapterContractPath: path.join(outDir, "extractor-adapter-contract", "extractor-adapter-contract.json"),
        sourceSpanStorePath: path.join(outDir, "source-span-store", "source-span-store.json"),
        evidenceItemStorePath: path.join(outDir, "evidence-item-store", "evidence-item-store.json"),
        factClaimStorePath: path.join(outDir, "fact-claim-store", "fact-claim-store.json"),
        issueGraphStorePath: path.join(outDir, "issue-graph-store", "issue-graph-store.json"),
        citationObjectStorePath: path.join(outDir, "citation-object-store", "citation-object-store.json"),
        lineageGraphBuilderPath: path.join(outDir, "lineage-graph", "lineage-graph.json"),
        evidenceCoverageScorePath: path.join(outDir, "evidence-coverage", "evidence-coverage-score.json"),
        evidenceFlagsPath: path.join(outDir, "evidence-flags", "evidence-flags.json"),
        exhibitMapPath: path.join(outDir, "exhibit-map", "exhibit-map.json"),
        chainOfCustodyEventsPath: path.join(outDir, "chain-of-custody", "chain-of-custody-events.json"),
        searchIndexContractPath: path.join(outDir, "search-index", "search-index-contract.json"),
        evidenceContractFreezePath: path.join(outDir, "evidence-contract-freeze", "evidence-contract-freeze.json"),
        capabilityWorkflowContractFreezePath: path.join(outDir, "capability-workflow-contract-freeze", "capability-workflow-contract-freeze.json"),
        runtimeAgentRunContractFreezePath: path.join(outDir, "runtime-agentrun-contract-freeze", "runtime-agentrun-contract-freeze.json"),
        gateApprovalContractFreezePath: path.join(outDir, "gate-approval-contract-freeze", "gate-approval-contract-freeze.json"),
        outputDeliveryContractFreezePath: path.join(outDir, "output-delivery-contract-freeze", "output-delivery-contract-freeze.json"),
        eventAuditRunContractFreezePath: path.join(outDir, "event-audit-run-contract-freeze", "event-audit-run-contract-freeze.json"),
        errorCostObservabilityContractFreezePath: path.join(outDir, "error-cost-observability-contract-freeze", "error-cost-observability-contract-freeze.json"),
        contextPacketLedgerPath: path.join(outDir, "context-packets", "context-packet-ledger.json"),
        modelRoutingLedgerPath: path.join(outDir, "model-routing", "model-routing-ledger.json"),
        modelPolicyEnforcementPath: path.join(outDir, "model-policy-enforcement", "model-policy-enforcement.json"),
        toolRuntimePolicyEnforcementPath: path.join(outDir, "tool-runtime-policy", "tool-runtime-policy-enforcement.json"),
        outputDestinationPolicyEnforcementPath: path.join(outDir, "output-destination-policy", "output-destination-policy-enforcement.json"),
        approvalAuthorityLedgerPath: path.join(outDir, "approval-authority", "approval-authority-ledger.json"),
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
        contractInventoryPath: path.join(outDir, "contract-inventory", "contract-inventory.json"),
        contractDependencyMapPath: path.join(outDir, "contract-dependency-map", "contract-dependency-map.json"),
        schemaVersioningRulesPath: path.join(outDir, "schema-versioning-rules", "schema-versioning-rules.json"),
        schemaMigrationManifestPath: path.join(outDir, "schema-migration-manifest", "schema-migration-manifest-ledger.json"),
        contractGoldenFixturesPath: path.join(outDir, "contract-golden-fixtures", "contract-golden-fixtures.json"),
        contractValidationSuitePath: path.join(outDir, "contract-validation-suite", "contract-validation-suite.json"),
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
        humanReviewCorrectionWorkspacePath: path.join(outDir, "human-review-correction-workspace", "human-review-correction-workspace.json"),
        humanReviewCorrectionWorkspaceMergePath: path.join(outDir, "human-review-correction-workspace-merge", "human-review-correction-workspace-merge.json"),
        humanReviewCorrectionValidationPath: path.join(outDir, "human-review-correction-validation", "control-plane-human-gate-receipt-validation.json"),
        humanReviewCorrectionFeedbackPath: path.join(outDir, "human-review-correction-feedback", "human-review-correction-feedback.json"),
        humanReviewCycleLedgerPath: path.join(outDir, "human-review-cycle-ledger", "human-review-cycle-ledger.json"),
        humanReviewCycleWorkOrdersPath: path.join(outDir, "human-review-cycle-work-orders", "human-review-cycle-work-orders.json"),
        humanReviewCycleTargetAuditPath: path.join(outDir, "human-review-cycle-work-order-target-audit", "human-review-cycle-work-order-target-audit.json"),
        humanReviewCycleTriageInboxPath: path.join(outDir, "human-review-cycle-triage-inbox", "human-review-cycle-triage-inbox.json"),
        humanReviewCycleReviewerConsolePath: path.join(outDir, "human-review-cycle-reviewer-console", "human-review-cycle-reviewer-console.json"),
        humanReviewCycleReceiptFieldAuditPath: path.join(outDir, "human-review-cycle-receipt-field-audit", "human-review-cycle-receipt-field-audit.json"),
        humanReviewCycleReceiptCompletionPackPath: path.join(outDir, "human-review-cycle-receipt-completion-pack", "human-review-cycle-receipt-completion-pack.json"),
        humanReviewCycleReceiptCompletionVerificationPath: path.join(outDir, "human-review-cycle-receipt-completion-verification", "human-review-cycle-receipt-completion-verification.json"),
        humanReviewCycleReceiptCompletionWorkbenchPath: path.join(outDir, "human-review-cycle-receipt-completion-workbench", "human-review-cycle-receipt-completion-workbench.json"),
        humanReviewCycleReceiptCompletionRunbookPath: path.join(outDir, "human-review-cycle-receipt-completion-runbook", "human-review-cycle-receipt-completion-runbook.json"),
        humanReviewCycleReceiptCompletionReadinessPath: path.join(outDir, "human-review-cycle-receipt-completion-readiness", "human-review-cycle-receipt-completion-readiness.json"),
        humanReviewCycleReceiptCompletionCommandQueuePath: path.join(outDir, "human-review-cycle-receipt-completion-command-queue", "human-review-cycle-receipt-completion-command-queue.json"),
        humanReviewCycleReceiptCompletionCommandReceiptsPath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipts", "human-review-cycle-receipt-completion-command-receipts.json"),
        humanReviewCycleReceiptCompletionCommandReceiptValidationPath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-validation", "human-review-cycle-receipt-completion-command-receipt-validation.json"),
        humanReviewCycleReceiptCompletionCommandReceiptFeedbackPath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-feedback", "human-review-cycle-receipt-completion-command-receipt-feedback.json"),
        humanReviewCycleReceiptCompletionCommandReceiptWorkspacePath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-workspace", "human-review-cycle-receipt-completion-command-receipt-workspace.json"),
        humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMergePath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-workspace-merge", "human-review-cycle-receipt-completion-command-receipt-workspace-merge.json"),
        humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidationPath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-workspace-validation", "human-review-cycle-receipt-completion-command-receipt-validation.json"),
        humanReviewCycleReceiptCompletionCommandReceiptApplicationPath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-application", "human-review-cycle-receipt-completion-command-receipt-application.json"),
        humanReviewCycleReceiptCompletionReconciliationPath: path.join(outDir, "human-review-cycle-receipt-completion-reconciliation", "human-review-cycle-receipt-completion-reconciliation.json"),
        humanReviewCycleReceiptCompletionBaselinePath: path.join(outDir, "human-review-cycle-receipt-completion-baseline", "human-review-cycle-receipt-completion-baseline.json"),
        humanReviewCycleReceiptCompletionManualCommandReceiptPackPath: path.join(outDir, "human-review-cycle-receipt-completion-manual-command-receipt-pack", "human-review-cycle-receipt-completion-manual-command-receipt-pack.json"),
        humanReviewCycleReceiptCompletionHeldCommandResolutionPath: path.join(outDir, "human-review-cycle-receipt-completion-held-command-resolution", "human-review-cycle-receipt-completion-held-command-resolution.json"),
        humanReviewCycleReceiptCompletionProtectedApprovalRequestPackPath: path.join(outDir, "human-review-cycle-receipt-completion-protected-approval-request-pack", "human-review-cycle-receipt-completion-protected-approval-request-pack.json"),
        humanReviewCycleReceiptCompletionManualRevalidationPath: path.join(outDir, "human-review-cycle-receipt-completion-manual-revalidation", "human-review-cycle-receipt-completion-manual-revalidation.json"),
        humanReviewCycleReceiptCompletionCommandQueuePatchProjectionPath: path.join(outDir, "human-review-cycle-receipt-completion-command-queue-patch-projection", "human-review-cycle-receipt-completion-command-queue-patch-projection.json"),
        humanReviewCycleReceiptCompletionCloseoutLedgerPath: path.join(outDir, "human-review-cycle-receipt-completion-closeout-ledger", "human-review-cycle-receipt-completion-closeout-ledger.json"),
        humanReviewV1RegressionFreezePath: path.join(outDir, "human-review-v1-regression-freeze", "human-review-v1-regression-freeze.json"),
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
        policySnapshotBindingLedgerPath: false,
        matterTaggingDecisionLedgerPath: false,
        accessAuditProjectionPath: false,
        storePolicyAdapterPath: false,
        controlPlaneActionPlanPath: false,
        controlPlaneHumanGatesPath: false,
        gateApprovalContractFreezePath: false,
        outputDeliveryContractFreezePath: false,
        eventAuditRunContractFreezePath: false,
        errorCostObservabilityContractFreezePath: false,
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
        humanReviewCorrectionWorkspacePath: false,
        humanReviewCorrectionWorkspaceMergePath: false,
        humanReviewCorrectionValidationPath: false,
        humanReviewCycleReviewerConsolePath: false,
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

      const gateApprovalContractFreeze = await runGateApprovalContractFreeze({
        lawFirmSlicePath: path.join(outDir, "law-firm-ldd", "law-firm-ldd-slice.json"),
        personalDevSlicePath: path.join(outDir, "personal-dev", "personal-dev-slice.json"),
        creativeDocumentSlicePath: path.join(outDir, "creative-document", "creative-document-slice.json"),
        capabilityWorkflowContractFreezePath: path.join(outDir, "capability-workflow-contract-freeze", "capability-workflow-contract-freeze.json"),
        runtimeAgentRunContractFreezePath: path.join(outDir, "runtime-agentrun-contract-freeze", "runtime-agentrun-contract-freeze.json"),
        observabilityCatalogPath: path.join(outDir, "observability", "observability-catalog.json"),
        outputArtifactCatalogPath: path.join(outDir, "output-catalog", "output-catalog.json"),
        approvalQueuePath: path.join(outDir, "approval-queue", "approval-queue.json"),
        approvalDecisionPath: path.join(outDir, "approval-decisions", "approval-decision-result.json"),
        approvalInboxPath: path.join(outDir, "approval-inbox", "approval-inbox.json"),
        approvalInboxDecisionPath: path.join(outDir, "approval-inbox-decisions", "approval-inbox-decision-result.json"),
        controlPlaneHumanGatesPath: path.join(outDir, "control-plane-human-gates", "control-plane-human-gates.json"),
        protectedApprovalRequestPackPath: false,
        outDir: path.join(outDir, "gate-approval-contract-freeze"),
        runAt: "2026-05-23T06:35:05.850Z",
      });
      const gateApprovalContractFreezeSchema = JSON.parse(await readFile("schemas/gate-approval-contract-freeze.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(gateApprovalContractFreeze, gateApprovalContractFreezeSchema, {}, "gate_approval_contract_freeze"),
        [],
      );
      assert.equal(gateApprovalContractFreeze.summary.freeze_status, "complete");
      assert.equal(gateApprovalContractFreeze.summary.gate_result_count, 14);
      assert.equal(gateApprovalContractFreeze.summary.human_approval_gate_count, 3);
      assert.equal(gateApprovalContractFreeze.summary.human_approval_gate_linked_count, 3);
      assert.equal(gateApprovalContractFreeze.summary.governance_output_approval_request_count, 3);
      assert.equal(gateApprovalContractFreeze.summary.approval_request_count, approvalQueue.summary.total_items + approvalInbox.summary.inbox_item_count + 3);
      assert.equal(gateApprovalContractFreeze.summary.output_approval_request_count, approvalInbox.summary.approval_request_count);
      assert.equal(gateApprovalContractFreeze.summary.gate_blocker_review_count, approvalInbox.summary.gate_review_count);
      assert.equal(gateApprovalContractFreeze.summary.evidence_review_request_count, approvalQueue.summary.by_type.evidence_review);
      assert.equal(gateApprovalContractFreeze.summary.protected_explicit_approval_request_count, 0);
      assert.equal(gateApprovalContractFreeze.summary.human_gate_contract_count, controlPlaneHumanGates.summary.gate_item_count);
      assert.equal(gateApprovalContractFreeze.summary.approval_decision_count, approvalResult.summary.applied_count + approvalInboxDecisionResult.summary.applied_count);
      assert.equal(gateApprovalContractFreeze.summary.validation_error_count, 0);
      assert.equal(gateApprovalContractFreeze.gate_approval_contract.gate_results[0].schema_version, "gate-result.v2");
      assert.equal(gateApprovalContractFreeze.gate_approval_contract.approval_requests[0].schema_version, "approval-request.v2");
      assert.equal(gateApprovalContractFreeze.gate_approval_contract.approval_decisions[0].schema_version, "approval-decision.v2");
      assert.equal(gateApprovalContractFreeze.gate_approval_contract.human_gate_contracts[0].schema_version, "human-gate-contract.v2");
      assert.equal(gateApprovalContractFreeze.gate_approval_contract.approval_authority_contracts[0].schema_version, "approval-authority-contract.v2");
      assert.equal(gateApprovalContractFreeze.gate_approval_contract.gate_approval_bindings[0].schema_version, "gate-approval-binding.v2");
      assert.ok(gateApprovalContractFreeze.gate_approval_contract.gate_results.every((gateResult) => !("approval_status" in gateResult)));
      assert.ok(gateApprovalContractFreeze.gate_approval_contract.gate_approval_bindings.filter((binding) => binding.human_approval_gate).every((binding) => binding.binding_status === "linked"));
      assert.ok(gateApprovalContractFreeze.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "gate-approval-contract-freeze", "summary.md"), "utf8"), /Gate\/Approval Contract Freeze/);

      const outputDeliveryContractFreeze = await runOutputDeliveryContractFreeze({
        outputArtifactCatalogPath: path.join(outDir, "output-catalog", "output-catalog.json"),
        protectedDeliveryQueuePath: path.join(outDir, "delivery-queue", "protected-delivery-queue.json"),
        approvalInboxDecisionPath: path.join(outDir, "approval-inbox-decisions", "approval-inbox-decision-result.json"),
        deliveryExecutionDraftPath: path.join(outDir, "delivery-execution", "delivery-execution-draft.json"),
        deliveryReceiptLedgerPath: path.join(outDir, "closeout-receipt-application", "delivery-receipt-ledger.json"),
        postDeliveryReconciliationPath: path.join(outDir, "post-delivery-reconciliation", "post-delivery-reconciliation.json"),
        gateApprovalContractFreezePath: path.join(outDir, "gate-approval-contract-freeze", "gate-approval-contract-freeze.json"),
        runtimeAgentRunContractFreezePath: path.join(outDir, "runtime-agentrun-contract-freeze", "runtime-agentrun-contract-freeze.json"),
        observabilityCatalogPath: path.join(outDir, "observability", "observability-catalog.json"),
        outDir: path.join(outDir, "output-delivery-contract-freeze"),
        runAt: "2026-05-23T06:35:05.900Z",
      });
      const outputDeliveryContractFreezeSchema = JSON.parse(await readFile("schemas/output-delivery-contract-freeze.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(outputDeliveryContractFreeze, outputDeliveryContractFreezeSchema, {}, "output_delivery_contract_freeze"),
        [],
      );
      assert.equal(outputDeliveryContractFreeze.summary.freeze_status, "complete");
      assert.equal(outputDeliveryContractFreeze.summary.output_artifact_count, outputCatalog.summary.artifact_count);
      assert.equal(outputDeliveryContractFreeze.summary.delivery_action_count, deliveryQueue.summary.delivery_action_count);
      assert.equal(outputDeliveryContractFreeze.summary.delivery_receipt_count, closeoutReceiptApplication.delivery_receipt_ledger.summary.applied_receipt_count);
      assert.equal(outputDeliveryContractFreeze.summary.artifact_hash_count, outputCatalog.summary.artifact_count);
      assert.equal(outputDeliveryContractFreeze.summary.missing_artifact_hash_count, 0);
      assert.equal(outputDeliveryContractFreeze.summary.linked_delivery_action_count, outputCatalog.summary.artifact_count);
      assert.equal(outputDeliveryContractFreeze.summary.missing_delivery_action_count, 0);
      assert.equal(outputDeliveryContractFreeze.summary.pending_approval_artifact_count, outputCatalog.summary.approval_pending_count);
      assert.equal(outputDeliveryContractFreeze.summary.approval_request_linked_artifact_count, outputCatalog.summary.approval_pending_count);
      assert.equal(outputDeliveryContractFreeze.summary.protected_delivery_action_count, deliveryQueue.summary.protected_action_count);
      assert.equal(outputDeliveryContractFreeze.summary.delivered_receipt_count, closeoutReceiptApplication.delivery_receipt_ledger.summary.delivered_packet_count);
      assert.equal(outputDeliveryContractFreeze.summary.validation_error_count, 0);
      assert.equal(outputDeliveryContractFreeze.output_delivery_contract.output_artifacts[0].schema_version, "output-artifact.v2");
      assert.equal(outputDeliveryContractFreeze.output_delivery_contract.delivery_actions[0].schema_version, "delivery-action.v2");
      assert.equal(outputDeliveryContractFreeze.output_delivery_contract.delivery_receipts[0].schema_version, "delivery-receipt.v2");
      assert.equal(outputDeliveryContractFreeze.output_delivery_contract.output_delivery_bindings[0].schema_version, "output-delivery-binding.v2");
      assert.equal(outputDeliveryContractFreeze.output_delivery_contract.delivery_state_transitions[0].schema_version, "delivery-state-transition.v2");
      assert.ok(outputDeliveryContractFreeze.output_delivery_contract.output_artifacts.every((artifact) => artifact.hash_status === "present"));
      assert.ok(outputDeliveryContractFreeze.output_delivery_contract.output_artifacts.every((artifact) => artifact.delivery_separation_status === "separate_delivery_action_linked"));
      assert.ok(outputDeliveryContractFreeze.output_delivery_contract.output_delivery_bindings.every((binding) => binding.binding_status === "linked"));
      assert.ok(outputDeliveryContractFreeze.output_delivery_contract.delivery_actions.every((action) => action.delivery_action_id !== action.output_artifact_id));
      assert.ok(outputDeliveryContractFreeze.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "output-delivery-contract-freeze", "summary.md"), "utf8"), /Output\/Delivery Contract Freeze/);

      const outputDestinationPolicyEnforcement = await runOutputDestinationPolicyEnforcement({
        policyMatrixCatalogPath: path.join(outDir, "policy-matrix", "policy-matrix-catalog.json"),
        outputDeliveryContractFreezePath: path.join(outDir, "output-delivery-contract-freeze", "output-delivery-contract-freeze.json"),
        protectedDeliveryQueuePath: path.join(outDir, "delivery-queue", "protected-delivery-queue.json"),
        deliveryExecutionDraftPath: path.join(outDir, "delivery-execution", "delivery-execution-draft.json"),
        toolRuntimePolicyEnforcementPath: path.join(outDir, "tool-runtime-policy", "tool-runtime-policy-enforcement.json"),
        outDir: path.join(outDir, "output-destination-policy"),
        runAt: "2026-05-23T06:35:05.925Z",
      });
      const outputDestinationPolicyEnforcementSchema = JSON.parse(await readFile("schemas/output-destination-policy-enforcement.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(outputDestinationPolicyEnforcement, outputDestinationPolicyEnforcementSchema, {}, "output_destination_policy_enforcement"),
        [],
      );
      assert.equal(
        outputDestinationPolicyEnforcement.summary.output_destination_policy_status,
        "complete",
        JSON.stringify(outputDestinationPolicyEnforcement.validation.errors, null, 2),
      );
      assert.equal(outputDestinationPolicyEnforcement.summary.source_policy_matrix_status, "valid");
      assert.equal(outputDestinationPolicyEnforcement.summary.source_output_delivery_contract_status, "complete");
      assert.equal(outputDestinationPolicyEnforcement.summary.source_delivery_execution_mode, "draft_only");
      assert.equal(outputDestinationPolicyEnforcement.summary.source_tool_runtime_policy_status, "complete");
      assert.equal(outputDestinationPolicyEnforcement.summary.policy_rule_count, policyMatrixCatalog.summary.output_rule_count);
      assert.equal(outputDestinationPolicyEnforcement.summary.artifact_destination_gate_count, outputDeliveryContractFreeze.summary.output_artifact_count);
      assert.equal(outputDestinationPolicyEnforcement.summary.delivery_action_destination_gate_count, outputDeliveryContractFreeze.summary.delivery_action_count);
      assert.equal(outputDestinationPolicyEnforcement.summary.final_action_required_delivery_count, outputDeliveryContractFreeze.summary.protected_delivery_action_count);
      assert.equal(outputDestinationPolicyEnforcement.summary.protected_destination_count, outputDeliveryContractFreeze.summary.protected_delivery_action_count);
      assert.equal(outputDestinationPolicyEnforcement.summary.unsafe_final_action_count, 0);
      assert.equal(outputDestinationPolicyEnforcement.summary.missing_policy_count, 0);
      assert.equal(outputDestinationPolicyEnforcement.summary.missing_tool_policy_count, 0);
      assert.equal(outputDestinationPolicyEnforcement.summary.missing_output_destination_gate_count, 0);
      assert.equal(outputDestinationPolicyEnforcement.summary.validation_error_count, 0);
      assert.ok(outputDestinationPolicyEnforcement.output_destination_policy_catalog.policy_rules.some((rule) => (
        rule.artifact_type === "email_draft" && rule.destination_tool_id === "email.send"
      )));
      assert.ok(outputDestinationPolicyEnforcement.output_destination_policy_catalog.policy_rules.some((rule) => (
        rule.artifact_type === "erp_billing_draft" && rule.destination_tool_id === "erp.billing.issue"
      )));
      assert.ok(outputDestinationPolicyEnforcement.output_destination_policy_catalog.policy_rules.some((rule) => (
        rule.artifact_type === "pr_draft" && rule.destination_tool_id === "github.merge"
      )));
      assert.ok(outputDestinationPolicyEnforcement.output_destination_policy_catalog.artifact_destination_gates.every((gate) => (
        !gate.final_action_required || gate.required_gates.includes("output_destination_gate")
      )));
      assert.ok(outputDestinationPolicyEnforcement.output_destination_policy_catalog.delivery_action_destination_gates.every((gate) => (
        (gate.draft_only || gate.executed) && !gate.unsafe_final_action && gate.required_gates.includes("output_destination_gate")
      )));
      assert.ok(outputDestinationPolicyEnforcement.output_destination_policy_catalog.final_action_separation_gates.filter((gate) => gate.destination_tool_id).every((gate) => (
        gate.tool_policy_known && gate.protected_tool_gate_present
      )));
      assert.ok(outputDestinationPolicyEnforcement.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "output-destination-policy", "summary.md"), "utf8"), /Output Destination Policy Enforcement/);

      const approvalAuthorityLedger = await runApprovalAuthorityLedger({
        identityModelPath: path.join(outDir, "identity-model", "identity-model.json"),
        matterProfileTeamLedgerPath: path.join(outDir, "matter-profile-team-ledger", "matter-profile-team-ledger.json"),
        gateApprovalContractFreezePath: path.join(outDir, "gate-approval-contract-freeze", "gate-approval-contract-freeze.json"),
        outputDeliveryContractFreezePath: path.join(outDir, "output-delivery-contract-freeze", "output-delivery-contract-freeze.json"),
        outputDestinationPolicyEnforcementPath: path.join(outDir, "output-destination-policy", "output-destination-policy-enforcement.json"),
        outDir: path.join(outDir, "approval-authority"),
        runAt: "2026-05-23T06:35:05.926Z",
      });
      const approvalAuthorityLedgerSchema = JSON.parse(await readFile("schemas/approval-authority-ledger.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(approvalAuthorityLedger, approvalAuthorityLedgerSchema, {}, "approval_authority_ledger"),
        [],
      );
      assert.equal(approvalAuthorityLedger.summary.approval_authority_status, "complete");
      assert.equal(approvalAuthorityLedger.summary.source_gate_approval_contract_status, "complete");
      assert.equal(approvalAuthorityLedger.summary.source_output_delivery_contract_status, "complete");
      assert.equal(approvalAuthorityLedger.summary.source_output_destination_policy_status, "complete");
      assert.equal(approvalAuthorityLedger.summary.artifact_authority_decision_count, outputDeliveryContractFreeze.summary.output_artifact_count);
      assert.equal(approvalAuthorityLedger.summary.delivery_action_authority_decision_count, outputDeliveryContractFreeze.summary.delivery_action_count);
      assert.equal(approvalAuthorityLedger.summary.approval_request_authority_decision_count, gateApprovalContractFreeze.summary.approval_request_count);
      assert.equal(approvalAuthorityLedger.summary.law_firm_human_required_decision_count, approvalAuthorityLedger.summary.law_firm_authority_decision_count);
      assert.equal(approvalAuthorityLedger.summary.nonhuman_authority_blocked_count, approvalAuthorityLedger.summary.authority_decision_count);
      assert.equal(approvalAuthorityLedger.summary.missing_authority_role_count, 0);
      assert.equal(approvalAuthorityLedger.summary.validation_error_count, 0);
      assert.ok(approvalAuthorityLedger.approval_authority_catalog.authority_policies.some((policy) => policy.required_authority_role === "responsible_partner_or_reviewer"));
      assert.ok(approvalAuthorityLedger.approval_authority_catalog.artifact_authority_decisions.every((decision) => decision.human_authority_required));
      assert.ok(approvalAuthorityLedger.approval_authority_catalog.delivery_action_authority_decisions.every((decision) => decision.nonhuman_authority_blocked));
      assert.ok(approvalAuthorityLedger.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "approval-authority", "summary.md"), "utf8"), /Approval Authority Ledger/);

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

      const humanReviewCorrectionWorkspace = await runHumanReviewCorrectionWorkspace({
        feedbackPath: path.join(outDir, "human-review-validation-feedback", "human-review-validation-feedback.json"),
        mergePath: path.join(outDir, "human-review-decision-register-merge", "human-review-decision-register-merge.json"),
        outDir: path.join(outDir, "human-review-correction-workspace"),
        runAt: "2026-05-23T06:35:06.090Z",
      });
      const humanReviewCorrectionWorkspaceSchema = JSON.parse(await readFile("schemas/human-review-correction-workspace.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCorrectionWorkspace, humanReviewCorrectionWorkspaceSchema, {}, "human_review_correction_workspace"),
        [],
      );
      assert.equal(humanReviewCorrectionWorkspace.workspace_status, "pending_human_review");
      assert.equal(humanReviewCorrectionWorkspace.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCorrectionWorkspace.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewCorrectionWorkspace.summary.actor_workspace_count, humanReviewValidationFeedback.summary.actor_feedback_count);
      assert.equal(
        humanReviewCorrectionWorkspace.summary.correction_item_count,
        humanReviewValidationFeedback.summary.pending_receipt_count + humanReviewValidationFeedback.summary.needs_correction_count,
      );
      assert.equal(humanReviewCorrectionWorkspace.summary.receipt_row_count, humanReviewCorrectionWorkspace.summary.correction_item_count);
      assert.equal(humanReviewCorrectionWorkspace.summary.pending_decision_count, humanReviewValidationFeedback.summary.pending_receipt_count);
      assert.equal(humanReviewCorrectionWorkspace.summary.needs_correction_count, humanReviewValidationFeedback.summary.needs_correction_count);
      assert.equal(humanReviewCorrectionWorkspace.summary.validation_error_count, 0);
      assert.ok(humanReviewCorrectionWorkspace.correction_items.every((item) => item.safe_handling.auto_execute_allowed === false));
      assert.ok(humanReviewCorrectionWorkspace.correction_items.every((item) => item.editable_receipt && item.target_receipt_input_path));
      assert.match(await readFile(path.join(outDir, "human-review-correction-workspace", "summary.md"), "utf8"), /Human Review Correction Workspace/);
      assert.match(
        await readFile(path.join(outDir, "human-review-correction-workspace", "actors", "attorney_or_designated_reviewer", "corrections.md"), "utf8"),
        /Human Review Corrections/,
      );

      const humanReviewCorrectionWorkspaceMerge = await runHumanReviewCorrectionWorkspaceMerge({
        workspacePath: path.join(outDir, "human-review-correction-workspace", "human-review-correction-workspace.json"),
        outDir: path.join(outDir, "human-review-correction-workspace-merge"),
        runAt: "2026-05-23T06:35:06.100Z",
      });
      const humanReviewCorrectionWorkspaceMergeSchema = JSON.parse(await readFile("schemas/human-review-correction-workspace-merge.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCorrectionWorkspaceMerge, humanReviewCorrectionWorkspaceMergeSchema, {}, "human_review_correction_workspace_merge"),
        [],
      );
      assert.equal(humanReviewCorrectionWorkspaceMerge.merge_status, "pending_receipts");
      assert.equal(humanReviewCorrectionWorkspaceMerge.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCorrectionWorkspaceMerge.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewCorrectionWorkspaceMerge.summary.actor_input_count, humanReviewCorrectionWorkspace.summary.actor_workspace_count);
      assert.equal(humanReviewCorrectionWorkspaceMerge.summary.receipt_row_count, humanReviewCorrectionWorkspace.summary.correction_item_count);
      assert.equal(humanReviewCorrectionWorkspaceMerge.summary.expected_receipt_count, humanReviewCorrectionWorkspace.summary.correction_item_count);
      assert.equal(humanReviewCorrectionWorkspaceMerge.summary.pending_receipt_count, humanReviewCorrectionWorkspace.summary.pending_decision_count);
      assert.equal(humanReviewCorrectionWorkspaceMerge.summary.ready_for_validation_count, 0);
      assert.equal(humanReviewCorrectionWorkspaceMerge.summary.missing_receipt_count, 0);
      assert.equal(humanReviewCorrectionWorkspaceMerge.summary.duplicate_receipt_count, 0);
      assert.equal(humanReviewCorrectionWorkspaceMerge.summary.unknown_receipt_count, 0);
      assert.equal(humanReviewCorrectionWorkspaceMerge.summary.invalid_correction_receipt_count, 0);
      assert.equal(humanReviewCorrectionWorkspaceMerge.summary.validation_error_count, 0);
      assert.equal(humanReviewCorrectionWorkspaceMerge.receipt_input.receipts.length, humanReviewCorrectionWorkspace.summary.correction_item_count);
      assert.ok(humanReviewCorrectionWorkspaceMerge.merge_items.every((item) => item.safe_handling.auto_execute_allowed === false));
      assert.match(await readFile(path.join(outDir, "human-review-correction-workspace-merge", "summary.md"), "utf8"), /Human Review Correction Workspace Merge/);

      const humanReviewCorrectionValidation = await runControlPlaneHumanGateReceiptValidation({
        receiptDraftsPath: path.join(outDir, "control-plane-human-gate-receipts", "control-plane-human-gate-receipt-drafts.json"),
        receiptInputPath: path.join(outDir, "human-review-correction-workspace-merge", "receipt-input.json"),
        outDir: path.join(outDir, "human-review-correction-validation"),
        runAt: "2026-05-23T06:35:06.125Z",
      });
      assert.deepEqual(
        validateAgainstSchema(humanReviewCorrectionValidation, controlPlaneHumanGateReceiptValidationSchema, {}, "human_review_correction_validation"),
        [],
      );
      assert.equal(humanReviewCorrectionValidation.validation_status, "pending_receipts");
      assert.equal(humanReviewCorrectionValidation.summary.validation_item_count, humanReviewCorrectionWorkspaceMerge.summary.receipt_row_count);
      assert.equal(humanReviewCorrectionValidation.summary.receipt_count, humanReviewCorrectionWorkspaceMerge.summary.receipt_row_count);
      assert.equal(humanReviewCorrectionValidation.summary.pending_receipt_count, humanReviewCorrectionWorkspaceMerge.summary.pending_receipt_count);
      assert.equal(humanReviewCorrectionValidation.summary.ready_to_apply_count, 0);
      assert.equal(humanReviewCorrectionValidation.summary.missing_receipt_count, 0);
      assert.equal(humanReviewCorrectionValidation.summary.invalid_receipt_count, 0);
      assert.equal(humanReviewCorrectionValidation.summary.unknown_receipt_count, 0);
      assert.equal(humanReviewCorrectionValidation.summary.error_count, 0);
      assert.equal(humanReviewCorrectionValidation.validated_receipts_to_apply.receipts.length, 0);
      assert.match(await readFile(path.join(outDir, "human-review-correction-validation", "summary.md"), "utf8"), /Control Plane Human Gate Receipt Validation/);

      const humanReviewCorrectionFeedback = await runHumanReviewCorrectionFeedback({
        mergePath: path.join(outDir, "human-review-correction-workspace-merge", "human-review-correction-workspace-merge.json"),
        validationPath: path.join(outDir, "human-review-correction-validation", "control-plane-human-gate-receipt-validation.json"),
        outDir: path.join(outDir, "human-review-correction-feedback"),
        runAt: "2026-05-23T06:35:06.135Z",
      });
      const humanReviewCorrectionFeedbackSchema = JSON.parse(await readFile("schemas/human-review-correction-feedback.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCorrectionFeedback, humanReviewCorrectionFeedbackSchema, {}, "human_review_correction_feedback"),
        [],
      );
      assert.equal(humanReviewCorrectionFeedback.feedback_status, "pending_human_review");
      assert.equal(humanReviewCorrectionFeedback.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCorrectionFeedback.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewCorrectionFeedback.summary.actor_feedback_count, humanReviewCorrectionWorkspaceMerge.summary.actor_input_count);
      assert.equal(humanReviewCorrectionFeedback.summary.feedback_item_count, humanReviewCorrectionValidation.summary.validation_item_count);
      assert.equal(humanReviewCorrectionFeedback.summary.pending_receipt_count, humanReviewCorrectionValidation.summary.pending_receipt_count);
      assert.equal(humanReviewCorrectionFeedback.summary.ready_for_application_count, 0);
      assert.equal(humanReviewCorrectionFeedback.summary.needs_correction_count, 0);
      assert.equal(humanReviewCorrectionFeedback.summary.missing_validation_count, 0);
      assert.equal(humanReviewCorrectionFeedback.summary.validation_error_count, 0);
      assert.ok(humanReviewCorrectionFeedback.feedback_items.every((item) => item.safe_handling.auto_execute_allowed === false));
      assert.ok(humanReviewCorrectionFeedback.feedback_items.every((item) => item.next_actions.length > 0));
      assert.match(await readFile(path.join(outDir, "human-review-correction-feedback", "summary.md"), "utf8"), /Human Review Correction Feedback/);
      assert.match(
        await readFile(path.join(outDir, "human-review-correction-feedback", "actors", "attorney_or_designated_reviewer", "feedback.md"), "utf8"),
        /Human Review Correction Feedback/,
      );

      const humanReviewCycleLedger = await runHumanReviewCycleLedger({
        validationFeedbackPath: path.join(outDir, "human-review-validation-feedback", "human-review-validation-feedback.json"),
        correctionWorkspacePath: path.join(outDir, "human-review-correction-workspace", "human-review-correction-workspace.json"),
        correctionWorkspaceMergePath: path.join(outDir, "human-review-correction-workspace-merge", "human-review-correction-workspace-merge.json"),
        correctionValidationPath: path.join(outDir, "human-review-correction-validation", "control-plane-human-gate-receipt-validation.json"),
        correctionFeedbackPath: path.join(outDir, "human-review-correction-feedback", "human-review-correction-feedback.json"),
        outDir: path.join(outDir, "human-review-cycle-ledger"),
        runAt: "2026-05-23T06:35:06.140Z",
      });
      const humanReviewCycleLedgerSchema = JSON.parse(await readFile("schemas/human-review-cycle-ledger.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleLedger, humanReviewCycleLedgerSchema, {}, "human_review_cycle_ledger"),
        [],
      );
      assert.equal(humanReviewCycleLedger.cycle_status, "pending_human_review");
      assert.equal(humanReviewCycleLedger.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCycleLedger.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewCycleLedger.summary.actor_cycle_count, humanReviewCorrectionFeedback.summary.actor_feedback_count);
      assert.equal(humanReviewCycleLedger.summary.cycle_item_count, humanReviewCorrectionFeedback.summary.feedback_item_count);
      assert.equal(humanReviewCycleLedger.summary.pending_human_review_count, humanReviewCorrectionFeedback.summary.pending_receipt_count);
      assert.equal(humanReviewCycleLedger.summary.ready_for_application_count, 0);
      assert.equal(humanReviewCycleLedger.summary.attention_count, 0);
      assert.equal(humanReviewCycleLedger.summary.validation_error_count, 0);
      assert.ok(humanReviewCycleLedger.cycle_items.every((item) => item.safe_handling.auto_execute_allowed === false));
      assert.ok(humanReviewCycleLedger.cycle_items.every((item) => item.correction_feedback_item_id));
      assert.match(await readFile(path.join(outDir, "human-review-cycle-ledger", "summary.md"), "utf8"), /Human Review Cycle Ledger/);
      assert.match(
        await readFile(path.join(outDir, "human-review-cycle-ledger", "actors", "attorney_or_designated_reviewer", "cycle.md"), "utf8"),
        /Human Review Cycle/,
      );

      const humanReviewCycleWorkOrders = await runHumanReviewCycleWorkOrders({
        cycleLedgerPath: path.join(outDir, "human-review-cycle-ledger", "human-review-cycle-ledger.json"),
        correctionWorkspacePath: path.join(outDir, "human-review-correction-workspace", "human-review-correction-workspace.json"),
        correctionFeedbackPath: path.join(outDir, "human-review-correction-feedback", "human-review-correction-feedback.json"),
        outDir: path.join(outDir, "human-review-cycle-work-orders"),
        runAt: "2026-05-23T06:35:06.145Z",
      });
      const humanReviewCycleWorkOrdersSchema = JSON.parse(await readFile("schemas/human-review-cycle-work-orders.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleWorkOrders, humanReviewCycleWorkOrdersSchema, {}, "human_review_cycle_work_orders"),
        [],
      );
      assert.equal(humanReviewCycleWorkOrders.work_order_status, "pending_human_review");
      assert.equal(humanReviewCycleWorkOrders.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCycleWorkOrders.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewCycleWorkOrders.summary.actor_work_order_count, humanReviewCycleLedger.summary.actor_cycle_count);
      assert.equal(humanReviewCycleWorkOrders.summary.work_order_item_count, humanReviewCycleLedger.summary.cycle_item_count);
      assert.equal(humanReviewCycleWorkOrders.summary.pending_human_review_count, humanReviewCycleLedger.summary.pending_human_review_count);
      assert.equal(humanReviewCycleWorkOrders.summary.ready_for_application_count, 0);
      assert.equal(humanReviewCycleWorkOrders.summary.attention_count, 0);
      assert.equal(humanReviewCycleWorkOrders.summary.validation_error_count, 0);
      assert.ok(humanReviewCycleWorkOrders.actor_work_orders.every((order) => order.safe_handling.auto_execute_allowed === false));
      assert.ok(humanReviewCycleWorkOrders.work_order_items.every((item) => item.safe_handling.auto_execute_allowed === false));
      assert.ok(humanReviewCycleWorkOrders.work_order_items.every((item) => item.next_actions.length > 0));
      assert.ok(humanReviewCycleWorkOrders.work_order_items.every((item) => item.target_receipt_input_path.includes("human-review-correction-workspace")));
      assert.match(await readFile(path.join(outDir, "human-review-cycle-work-orders", "summary.md"), "utf8"), /Human Review Cycle Work Orders/);
      assert.match(
        await readFile(path.join(outDir, "human-review-cycle-work-orders", "actors", "attorney_or_designated_reviewer", "work-order.md"), "utf8"),
        /Human Review Cycle Work Order/,
      );

      const humanReviewCycleTargetAudit = await runHumanReviewCycleWorkOrderTargetAudit({
        workOrdersPath: path.join(outDir, "human-review-cycle-work-orders", "human-review-cycle-work-orders.json"),
        outDir: path.join(outDir, "human-review-cycle-work-order-target-audit"),
        runAt: "2026-05-23T06:35:06.147Z",
      });
      const humanReviewCycleTargetAuditSchema = JSON.parse(await readFile("schemas/human-review-cycle-work-order-target-audit.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleTargetAudit, humanReviewCycleTargetAuditSchema, {}, "human_review_cycle_target_audit"),
        [],
      );
      assert.equal(humanReviewCycleTargetAudit.target_audit_status, "ready_for_human_review");
      assert.equal(humanReviewCycleTargetAudit.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCycleTargetAudit.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewCycleTargetAudit.summary.actor_target_audit_count, humanReviewCycleWorkOrders.summary.actor_work_order_count);
      assert.equal(humanReviewCycleTargetAudit.summary.target_audit_item_count, humanReviewCycleWorkOrders.summary.work_order_item_count);
      assert.equal(humanReviewCycleTargetAudit.summary.ready_target_count, humanReviewCycleWorkOrders.summary.work_order_item_count);
      assert.equal(humanReviewCycleTargetAudit.summary.blocked_count, 0);
      assert.equal(humanReviewCycleTargetAudit.summary.missing_target_file_count, 0);
      assert.equal(humanReviewCycleTargetAudit.summary.missing_receipt_row_count, 0);
      assert.equal(humanReviewCycleTargetAudit.summary.validation_error_count, 0);
      assert.ok(humanReviewCycleTargetAudit.target_audit_items.every((item) => item.receipt_row_present));
      assert.ok(humanReviewCycleTargetAudit.target_audit_items.every((item) => item.safe_handling.auto_execute_allowed === false));
      assert.match(await readFile(path.join(outDir, "human-review-cycle-work-order-target-audit", "summary.md"), "utf8"), /Human Review Cycle Work Order Target Audit/);
      assert.match(
        await readFile(path.join(outDir, "human-review-cycle-work-order-target-audit", "actors", "attorney_or_designated_reviewer", "target-audit.md"), "utf8"),
        /Human Review Work Order Target Audit/,
      );

      const humanReviewCycleTriageInbox = await runHumanReviewCycleTriageInbox({
        workOrdersPath: path.join(outDir, "human-review-cycle-work-orders", "human-review-cycle-work-orders.json"),
        targetAuditPath: path.join(outDir, "human-review-cycle-work-order-target-audit", "human-review-cycle-work-order-target-audit.json"),
        outDir: path.join(outDir, "human-review-cycle-triage-inbox"),
        runAt: "2026-05-23T06:35:06.148Z",
      });
      const humanReviewCycleTriageInboxSchema = JSON.parse(await readFile("schemas/human-review-cycle-triage-inbox.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleTriageInbox, humanReviewCycleTriageInboxSchema, {}, "human_review_cycle_triage_inbox"),
        [],
      );
      assert.equal(humanReviewCycleTriageInbox.triage_status, "ready_for_human_review");
      assert.equal(humanReviewCycleTriageInbox.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCycleTriageInbox.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewCycleTriageInbox.summary.actor_triage_inbox_count, humanReviewCycleWorkOrders.summary.actor_work_order_count);
      assert.equal(humanReviewCycleTriageInbox.summary.triage_item_count, humanReviewCycleWorkOrders.summary.work_order_item_count);
      assert.equal(humanReviewCycleTriageInbox.summary.ready_for_human_review_count, humanReviewCycleTargetAudit.summary.ready_target_count);
      assert.equal(humanReviewCycleTriageInbox.summary.blocked_count, 0);
      assert.equal(humanReviewCycleTriageInbox.summary.validation_error_count, 0);
      assert.ok(humanReviewCycleTriageInbox.triage_items.every((item) => item.target_audit_item_id));
      assert.ok(humanReviewCycleTriageInbox.triage_items.every((item) => item.safe_handling.auto_execute_allowed === false));
      assert.match(await readFile(path.join(outDir, "human-review-cycle-triage-inbox", "summary.md"), "utf8"), /Human Review Cycle Triage Inbox/);
      assert.match(
        await readFile(path.join(outDir, "human-review-cycle-triage-inbox", "actors", "attorney_or_designated_reviewer", "triage-inbox.md"), "utf8"),
        /Human Review Cycle Triage Inbox/,
      );

      const humanReviewCycleReviewerConsole = await runHumanReviewCycleReviewerConsole({
        triageInboxPath: path.join(outDir, "human-review-cycle-triage-inbox", "human-review-cycle-triage-inbox.json"),
        contextBundlePath: path.join(outDir, "human-review-context-bundle", "human-review-context-bundle.json"),
        decisionRegisterPath: path.join(outDir, "human-review-decision-register", "human-review-decision-register.json"),
        outDir: path.join(outDir, "human-review-cycle-reviewer-console"),
        runAt: "2026-05-23T06:35:06.149Z",
      });
      const humanReviewCycleReviewerConsoleSchema = JSON.parse(await readFile("schemas/human-review-cycle-reviewer-console.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReviewerConsole, humanReviewCycleReviewerConsoleSchema, {}, "human_review_cycle_reviewer_console"),
        [],
      );
      assert.equal(humanReviewCycleReviewerConsole.console_status, "ready_for_human_review");
      assert.equal(humanReviewCycleReviewerConsole.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCycleReviewerConsole.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewCycleReviewerConsole.summary.actor_console_count, humanReviewCycleTriageInbox.summary.actor_triage_inbox_count);
      assert.equal(humanReviewCycleReviewerConsole.summary.console_item_count, humanReviewCycleTriageInbox.summary.triage_item_count);
      assert.equal(humanReviewCycleReviewerConsole.summary.ready_for_human_review_count, humanReviewCycleTriageInbox.summary.ready_for_human_review_count);
      assert.equal(humanReviewCycleReviewerConsole.summary.missing_context_card_count, 0);
      assert.equal(humanReviewCycleReviewerConsole.summary.missing_decision_row_count, 0);
      assert.equal(humanReviewCycleReviewerConsole.summary.validation_error_count, 0);
      assert.ok(humanReviewCycleReviewerConsole.console_items.every((item) => item.context_card_id));
      assert.ok(humanReviewCycleReviewerConsole.console_items.every((item) => item.decision_row_id));
      assert.ok(humanReviewCycleReviewerConsole.console_items.every((item) => item.safe_handling.auto_execute_allowed === false));
      assert.match(await readFile(path.join(outDir, "human-review-cycle-reviewer-console", "summary.md"), "utf8"), /Human Review Cycle Reviewer Console/);
      assert.match(await readFile(path.join(outDir, "human-review-cycle-reviewer-console", "index.html"), "utf8"), /Human Review Cycle Reviewer Console/);
      assert.match(
        await readFile(path.join(outDir, "human-review-cycle-reviewer-console", "actors", "attorney_or_designated_reviewer", "reviewer-console.md"), "utf8"),
        /Human Review Cycle Reviewer Console/,
      );

      const humanReviewCycleReceiptFieldAudit = await runHumanReviewCycleReceiptFieldAudit({
        reviewerConsolePath: path.join(outDir, "human-review-cycle-reviewer-console", "human-review-cycle-reviewer-console.json"),
        outDir: path.join(outDir, "human-review-cycle-receipt-field-audit"),
        runAt: "2026-05-23T06:35:06.150Z",
      });
      const humanReviewCycleReceiptFieldAuditSchema = JSON.parse(await readFile("schemas/human-review-cycle-receipt-field-audit.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReceiptFieldAudit, humanReviewCycleReceiptFieldAuditSchema, {}, "human_review_cycle_receipt_field_audit"),
        [],
      );
      assert.equal(humanReviewCycleReceiptFieldAudit.field_audit_status, "pending_human_review");
      assert.equal(humanReviewCycleReceiptFieldAudit.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCycleReceiptFieldAudit.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewCycleReceiptFieldAudit.summary.actor_field_audit_count, humanReviewCycleReviewerConsole.summary.actor_console_count);
      assert.equal(humanReviewCycleReceiptFieldAudit.summary.field_audit_item_count, humanReviewCycleReviewerConsole.summary.console_item_count);
      assert.equal(humanReviewCycleReceiptFieldAudit.summary.pending_human_review_count, humanReviewCycleReviewerConsole.summary.ready_for_human_review_count);
      assert.equal(humanReviewCycleReceiptFieldAudit.summary.receipt_row_count, humanReviewCycleReviewerConsole.summary.console_item_count);
      assert.equal(humanReviewCycleReceiptFieldAudit.summary.missing_receipt_row_count, 0);
      assert.equal(humanReviewCycleReceiptFieldAudit.summary.validation_error_count, 0);
      assert.ok(humanReviewCycleReceiptFieldAudit.summary.missing_required_field_count > 0);
      assert.ok(humanReviewCycleReceiptFieldAudit.field_audit_items.every((item) => item.receipt_row_present));
      assert.ok(humanReviewCycleReceiptFieldAudit.field_audit_items.every((item) => item.pending_receipt));
      assert.ok(humanReviewCycleReceiptFieldAudit.field_audit_items.every((item) => item.safe_handling.auto_execute_allowed === false));
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-field-audit", "summary.md"), "utf8"), /Human Review Cycle Receipt Field Audit/);
      assert.match(
        await readFile(path.join(outDir, "human-review-cycle-receipt-field-audit", "actors", "attorney_or_designated_reviewer", "field-audit.md"), "utf8"),
        /Human Review Receipt Field Audit/,
      );

      const humanReviewCycleReceiptCompletionPack = await runHumanReviewCycleReceiptCompletionPack({
        fieldAuditPath: path.join(outDir, "human-review-cycle-receipt-field-audit", "human-review-cycle-receipt-field-audit.json"),
        outDir: path.join(outDir, "human-review-cycle-receipt-completion-pack"),
        runAt: "2026-05-23T06:35:06.151Z",
      });
      const humanReviewCycleReceiptCompletionPackSchema = JSON.parse(await readFile("schemas/human-review-cycle-receipt-completion-pack.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReceiptCompletionPack, humanReviewCycleReceiptCompletionPackSchema, {}, "human_review_cycle_receipt_completion_pack"),
        [],
      );
      assert.equal(humanReviewCycleReceiptCompletionPack.completion_status, "ready_for_human_input");
      assert.equal(humanReviewCycleReceiptCompletionPack.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCycleReceiptCompletionPack.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewCycleReceiptCompletionPack.summary.actor_completion_pack_count, humanReviewCycleReceiptFieldAudit.summary.actor_field_audit_count);
      assert.equal(humanReviewCycleReceiptCompletionPack.summary.completion_item_count, humanReviewCycleReceiptFieldAudit.summary.field_audit_item_count);
      assert.equal(humanReviewCycleReceiptCompletionPack.summary.ready_for_human_input_count, humanReviewCycleReceiptFieldAudit.summary.pending_human_review_count);
      const expectedTerminalDecisionPromptCount = humanReviewCycleReceiptFieldAudit.field_audit_items.reduce(
        (count, item) => count
          + (item.pending_receipt && item.required_receipt_fields.includes("receipt_status") ? 1 : 0)
          + (item.pending_receipt && item.required_receipt_fields.includes("outcome") ? 1 : 0),
        0,
      );
      assert.equal(humanReviewCycleReceiptCompletionPack.summary.template_field_prompt_count, humanReviewCycleReceiptFieldAudit.summary.missing_required_field_count + expectedTerminalDecisionPromptCount);
      assert.equal(humanReviewCycleReceiptCompletionPack.summary.validation_error_count, 0);
      assert.ok(humanReviewCycleReceiptCompletionPack.completion_items.every((item) => item.safe_handling.auto_execute_allowed === false));
      assert.ok(humanReviewCycleReceiptCompletionPack.completion_items.every((item) => item.field_prompts.length > 0));
      assert.ok(humanReviewCycleReceiptCompletionPack.completion_items.every((item) => item.field_prompts.some((prompt) => prompt.field_name === "receipt_status")));
      assert.ok(humanReviewCycleReceiptCompletionPack.completion_items.every((item) => item.field_prompts.some((prompt) => prompt.field_name === "outcome")));
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-pack", "summary.md"), "utf8"), /Human Review Cycle Receipt Completion Pack/);
      assert.match(
        await readFile(path.join(outDir, "human-review-cycle-receipt-completion-pack", "actors", "attorney_or_designated_reviewer", "completion-pack.md"), "utf8"),
        /Human Review Receipt Completion Pack/,
      );
      assert.match(
        await readFile(path.join(outDir, "human-review-cycle-receipt-completion-pack", "actors", "attorney_or_designated_reviewer", "receipt-completion-template.json"), "utf8"),
        /human-review-cycle-receipt-completion-template.v1/,
      );

      const humanReviewCycleReceiptCompletionVerification = await runHumanReviewCycleReceiptCompletionVerification({
        completionPackPath: path.join(outDir, "human-review-cycle-receipt-completion-pack", "human-review-cycle-receipt-completion-pack.json"),
        outDir: path.join(outDir, "human-review-cycle-receipt-completion-verification"),
        runAt: "2026-05-23T06:35:06.152Z",
      });
      const humanReviewCycleReceiptCompletionVerificationSchema = JSON.parse(await readFile("schemas/human-review-cycle-receipt-completion-verification.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReceiptCompletionVerification, humanReviewCycleReceiptCompletionVerificationSchema, {}, "human_review_cycle_receipt_completion_verification"),
        [],
      );
      assert.equal(humanReviewCycleReceiptCompletionVerification.verification_status, "pending_human_input");
      assert.equal(humanReviewCycleReceiptCompletionVerification.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCycleReceiptCompletionVerification.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewCycleReceiptCompletionVerification.summary.actor_verification_count, humanReviewCycleReceiptCompletionPack.summary.actor_completion_pack_count);
      assert.equal(humanReviewCycleReceiptCompletionVerification.summary.verification_item_count, humanReviewCycleReceiptCompletionPack.summary.completion_item_count);
      assert.equal(humanReviewCycleReceiptCompletionVerification.summary.pending_human_input_count, humanReviewCycleReceiptCompletionPack.summary.ready_for_human_input_count);
      assert.equal(humanReviewCycleReceiptCompletionVerification.summary.field_prompt_count, humanReviewCycleReceiptCompletionPack.summary.template_field_prompt_count);
      assert.equal(humanReviewCycleReceiptCompletionVerification.summary.pending_prompt_count, humanReviewCycleReceiptCompletionPack.summary.template_field_prompt_count);
      assert.equal(humanReviewCycleReceiptCompletionVerification.summary.ready_for_validation_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionVerification.summary.validation_error_count, 0);
      assert.ok(humanReviewCycleReceiptCompletionVerification.verification_items.every((item) => item.receipt_row_present));
      assert.ok(humanReviewCycleReceiptCompletionVerification.verification_items.every((item) => item.safe_handling.auto_execute_allowed === false));
      assert.ok(humanReviewCycleReceiptCompletionVerification.verification_items.every((item) => item.pending_prompt_count > 0));
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-verification", "summary.md"), "utf8"), /Human Review Cycle Receipt Completion Verification/);
      assert.match(
        await readFile(path.join(outDir, "human-review-cycle-receipt-completion-verification", "actors", "attorney_or_designated_reviewer", "completion-verification.md"), "utf8"),
        /Human Review Receipt Completion Verification/,
      );

      const humanReviewCycleReceiptCompletionWorkbench = await runHumanReviewCycleReceiptCompletionWorkbench({
        completionVerificationPath: path.join(outDir, "human-review-cycle-receipt-completion-verification", "human-review-cycle-receipt-completion-verification.json"),
        completionPackPath: path.join(outDir, "human-review-cycle-receipt-completion-pack", "human-review-cycle-receipt-completion-pack.json"),
        outDir: path.join(outDir, "human-review-cycle-receipt-completion-workbench"),
        runAt: "2026-05-23T06:35:06.153Z",
      });
      const humanReviewCycleReceiptCompletionWorkbenchSchema = JSON.parse(await readFile("schemas/human-review-cycle-receipt-completion-workbench.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReceiptCompletionWorkbench, humanReviewCycleReceiptCompletionWorkbenchSchema, {}, "human_review_cycle_receipt_completion_workbench"),
        [],
      );
      assert.equal(humanReviewCycleReceiptCompletionWorkbench.workbench_status, "pending_human_input");
      assert.equal(humanReviewCycleReceiptCompletionWorkbench.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCycleReceiptCompletionWorkbench.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewCycleReceiptCompletionWorkbench.summary.actor_workbench_count, humanReviewCycleReceiptCompletionVerification.summary.actor_verification_count);
      assert.equal(humanReviewCycleReceiptCompletionWorkbench.summary.workbench_item_count, humanReviewCycleReceiptCompletionVerification.summary.verification_item_count);
      assert.equal(humanReviewCycleReceiptCompletionWorkbench.summary.pending_human_input_count, humanReviewCycleReceiptCompletionVerification.summary.pending_human_input_count);
      assert.equal(humanReviewCycleReceiptCompletionWorkbench.summary.pending_prompt_count, humanReviewCycleReceiptCompletionVerification.summary.pending_prompt_count);
      assert.equal(humanReviewCycleReceiptCompletionWorkbench.summary.receipt_completion_template_count, humanReviewCycleReceiptCompletionPack.summary.actor_completion_pack_count);
      assert.equal(humanReviewCycleReceiptCompletionWorkbench.summary.validation_error_count, 0);
      assert.ok(humanReviewCycleReceiptCompletionWorkbench.workbench_items.every((item) => item.receipt_completion_template_path));
      assert.ok(humanReviewCycleReceiptCompletionWorkbench.workbench_items.every((item) => item.target_receipt_input_path));
      assert.ok(humanReviewCycleReceiptCompletionWorkbench.workbench_items.every((item) => item.safe_handling.auto_execute_allowed === false));
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-workbench", "summary.md"), "utf8"), /Human Review Cycle Receipt Completion Workbench/);
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-workbench", "index.html"), "utf8"), /Human Review Cycle Receipt Completion Workbench/);
      assert.match(
        await readFile(path.join(outDir, "human-review-cycle-receipt-completion-workbench", "actors", "attorney_or_designated_reviewer", "completion-workbench.html"), "utf8"),
        /Human Review Receipt Completion Workbench/,
      );

      const humanReviewCycleReceiptCompletionRunbook = await runHumanReviewCycleReceiptCompletionRunbook({
        completionWorkbenchPath: path.join(outDir, "human-review-cycle-receipt-completion-workbench", "human-review-cycle-receipt-completion-workbench.json"),
        completionVerificationPath: path.join(outDir, "human-review-cycle-receipt-completion-verification", "human-review-cycle-receipt-completion-verification.json"),
        outDir: path.join(outDir, "human-review-cycle-receipt-completion-runbook"),
        runAt: "2026-05-23T06:35:06.154Z",
      });
      const humanReviewCycleReceiptCompletionRunbookSchema = JSON.parse(await readFile("schemas/human-review-cycle-receipt-completion-runbook.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReceiptCompletionRunbook, humanReviewCycleReceiptCompletionRunbookSchema, {}, "human_review_cycle_receipt_completion_runbook"),
        [],
      );
      assert.equal(humanReviewCycleReceiptCompletionRunbook.runbook_status, "pending_human_input");
      assert.equal(humanReviewCycleReceiptCompletionRunbook.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCycleReceiptCompletionRunbook.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewCycleReceiptCompletionRunbook.summary.actor_runbook_count, humanReviewCycleReceiptCompletionWorkbench.summary.actor_workbench_count);
      assert.equal(humanReviewCycleReceiptCompletionRunbook.summary.workbench_item_count, humanReviewCycleReceiptCompletionWorkbench.summary.workbench_item_count);
      assert.equal(humanReviewCycleReceiptCompletionRunbook.summary.pending_human_input_count, humanReviewCycleReceiptCompletionWorkbench.summary.pending_human_input_count);
      assert.equal(humanReviewCycleReceiptCompletionRunbook.summary.pending_prompt_count, humanReviewCycleReceiptCompletionWorkbench.summary.pending_prompt_count);
      assert.ok(humanReviewCycleReceiptCompletionRunbook.summary.command_step_count > 0);
      assert.ok(humanReviewCycleReceiptCompletionRunbook.summary.manual_step_count > 0);
      assert.equal(humanReviewCycleReceiptCompletionRunbook.summary.validation_error_count, 0);
      assert.ok(humanReviewCycleReceiptCompletionRunbook.actor_runbooks.every((actor) => actor.workbench_html_path));
      assert.ok(humanReviewCycleReceiptCompletionRunbook.actor_runbooks.every((actor) => actor.receipt_completion_template_path));
      assert.ok(humanReviewCycleReceiptCompletionRunbook.runbook_steps.every((step) => step.safe_handling.auto_execute_allowed === false));
      assert.ok(humanReviewCycleReceiptCompletionRunbook.runbook_steps.some((step) => step.command === "npm run control-plane:review-cycle:completion-verify"));
      assert.ok(humanReviewCycleReceiptCompletionRunbook.runbook_steps.some((step) => step.command === "npm run control-plane:review-cycle:completion-runbook"));
      assert.ok(humanReviewCycleReceiptCompletionRunbook.runbook_steps.some((step) => step.requires_explicit_human_approval));
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-runbook", "summary.md"), "utf8"), /Human Review Cycle Receipt Completion Runbook/);
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-runbook", "index.html"), "utf8"), /Human Review Cycle Receipt Completion Runbook/);
      assert.match(
        await readFile(path.join(outDir, "human-review-cycle-receipt-completion-runbook", "actors", "attorney_or_designated_reviewer", "completion-runbook.html"), "utf8"),
        /Human Review Receipt Completion Runbook/,
      );

      const humanReviewCycleReceiptCompletionReadiness = await runHumanReviewCycleReceiptCompletionReadiness({
        completionRunbookPath: path.join(outDir, "human-review-cycle-receipt-completion-runbook", "human-review-cycle-receipt-completion-runbook.json"),
        completionVerificationPath: path.join(outDir, "human-review-cycle-receipt-completion-verification", "human-review-cycle-receipt-completion-verification.json"),
        outDir: path.join(outDir, "human-review-cycle-receipt-completion-readiness"),
        runAt: "2026-05-23T06:35:06.155Z",
      });
      const humanReviewCycleReceiptCompletionReadinessSchema = JSON.parse(await readFile("schemas/human-review-cycle-receipt-completion-readiness.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReceiptCompletionReadiness, humanReviewCycleReceiptCompletionReadinessSchema, {}, "human_review_cycle_receipt_completion_readiness"),
        [],
      );
      assert.equal(humanReviewCycleReceiptCompletionReadiness.readiness_status, "waiting_for_human_input");
      assert.equal(humanReviewCycleReceiptCompletionReadiness.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCycleReceiptCompletionReadiness.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewCycleReceiptCompletionReadiness.summary.actor_readiness_count, humanReviewCycleReceiptCompletionRunbook.summary.actor_runbook_count);
      assert.equal(humanReviewCycleReceiptCompletionReadiness.summary.command_gate_count, humanReviewCycleReceiptCompletionRunbook.summary.command_step_count + humanReviewCycleReceiptCompletionRunbook.summary.protected_step_count);
      assert.equal(humanReviewCycleReceiptCompletionReadiness.summary.manual_requirement_count, humanReviewCycleReceiptCompletionRunbook.summary.manual_step_count);
      assert.ok(humanReviewCycleReceiptCompletionReadiness.summary.allowed_command_count > 0);
      assert.ok(humanReviewCycleReceiptCompletionReadiness.summary.blocked_command_count > 0);
      assert.ok(humanReviewCycleReceiptCompletionReadiness.summary.blocked_until_manual_input_count > 0);
      assert.equal(humanReviewCycleReceiptCompletionReadiness.summary.protected_command_count, 1);
      assert.equal(humanReviewCycleReceiptCompletionReadiness.summary.manual_input_required_count, humanReviewCycleReceiptCompletionRunbook.summary.manual_step_count);
      assert.equal(humanReviewCycleReceiptCompletionReadiness.summary.validation_error_count, 0);
      assert.ok(humanReviewCycleReceiptCompletionReadiness.command_gates.every((gate) => gate.safe_handling.auto_execute_allowed === false));
      assert.ok(humanReviewCycleReceiptCompletionReadiness.command_gates.some((gate) => gate.requires_explicit_human_approval && gate.command_allowed_now === false));
      assert.ok(humanReviewCycleReceiptCompletionReadiness.command_gates.some((gate) => gate.command_status === "available_now"));
      assert.ok(humanReviewCycleReceiptCompletionReadiness.command_gates.some((gate) => gate.command_status === "blocked_until_manual_input"));
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-readiness", "summary.md"), "utf8"), /Human Review Cycle Receipt Completion Readiness/);
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-readiness", "index.html"), "utf8"), /Human Review Cycle Receipt Completion Readiness/);

      const humanReviewCycleReceiptCompletionCommandQueue = await runHumanReviewCycleReceiptCompletionCommandQueue({
        completionReadinessPath: path.join(outDir, "human-review-cycle-receipt-completion-readiness", "human-review-cycle-receipt-completion-readiness.json"),
        outDir: path.join(outDir, "human-review-cycle-receipt-completion-command-queue"),
        runAt: "2026-05-23T06:35:06.156Z",
      });
      const humanReviewCycleReceiptCompletionCommandQueueSchema = JSON.parse(await readFile("schemas/human-review-cycle-receipt-completion-command-queue.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReceiptCompletionCommandQueue, humanReviewCycleReceiptCompletionCommandQueueSchema, {}, "human_review_cycle_receipt_completion_command_queue"),
        [],
      );
      assert.equal(humanReviewCycleReceiptCompletionCommandQueue.queue_status, "ready_with_holds");
      assert.equal(humanReviewCycleReceiptCompletionCommandQueue.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueue.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueue.summary.command_queue_item_count, humanReviewCycleReceiptCompletionReadiness.summary.allowed_command_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueue.summary.held_command_item_count, humanReviewCycleReceiptCompletionReadiness.summary.blocked_command_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueue.summary.actor_command_queue_count, humanReviewCycleReceiptCompletionReadiness.summary.actor_readiness_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueue.summary.protected_held_command_count, 1);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueue.summary.manual_input_hold_count, humanReviewCycleReceiptCompletionReadiness.summary.blocked_until_manual_input_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueue.summary.validation_error_count, 0);
      assert.ok(humanReviewCycleReceiptCompletionCommandQueue.command_queue_items.every((item) => item.queue_status === "ready_to_run_manually"));
      assert.ok(humanReviewCycleReceiptCompletionCommandQueue.command_queue_items.every((item) => item.safe_handling.auto_execute_allowed === false));
      assert.ok(humanReviewCycleReceiptCompletionCommandQueue.held_command_items.some((item) => item.hold_status === "requires_explicit_human_approval"));
      assert.ok(humanReviewCycleReceiptCompletionCommandQueue.held_command_items.every((item) => item.safe_handling.protected_actions_executed === false));
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-command-queue", "summary.md"), "utf8"), /Human Review Cycle Receipt Completion Command Queue/);
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-command-queue", "index.html"), "utf8"), /Human Review Cycle Receipt Completion Command Queue/);

      const humanReviewCycleReceiptCompletionCommandReceipts = await runHumanReviewCycleReceiptCompletionCommandReceipts({
        commandQueuePath: path.join(outDir, "human-review-cycle-receipt-completion-command-queue", "human-review-cycle-receipt-completion-command-queue.json"),
        outDir: path.join(outDir, "human-review-cycle-receipt-completion-command-receipts"),
        runAt: "2026-05-23T06:35:06.157Z",
      });
      const humanReviewCycleReceiptCompletionCommandReceiptsSchema = JSON.parse(await readFile("schemas/human-review-cycle-receipt-completion-command-receipts.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReceiptCompletionCommandReceipts, humanReviewCycleReceiptCompletionCommandReceiptsSchema, {}, "human_review_cycle_receipt_completion_command_receipts"),
        [],
      );
      assert.equal(humanReviewCycleReceiptCompletionCommandReceipts.receipt_status, "pending_command_receipts");
      assert.equal(humanReviewCycleReceiptCompletionCommandReceipts.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceipts.safe_handling.command_receipts_only, true);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceipts.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceipts.summary.receipt_requirement_count, humanReviewCycleReceiptCompletionCommandQueue.summary.command_queue_item_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceipts.summary.receipt_draft_count, humanReviewCycleReceiptCompletionCommandQueue.summary.command_queue_item_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceipts.summary.pending_receipt_count, humanReviewCycleReceiptCompletionCommandReceipts.summary.receipt_draft_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceipts.summary.held_command_reference_count, humanReviewCycleReceiptCompletionCommandQueue.summary.held_command_item_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceipts.summary.protected_held_command_count, humanReviewCycleReceiptCompletionCommandQueue.summary.protected_held_command_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceipts.summary.validation_error_count, 0);
      assert.ok(humanReviewCycleReceiptCompletionCommandReceipts.receipt_input_draft.receipts.every((receipt) => receipt.receipt_status === "pending"));
      assert.ok(humanReviewCycleReceiptCompletionCommandReceipts.receipt_input_draft.receipts.every((receipt) => receipt.command_result === "not_run"));
      assert.ok(humanReviewCycleReceiptCompletionCommandReceipts.receipt_requirements.every((requirement) => requirement.command_kind !== "protected_application"));
      assert.ok(humanReviewCycleReceiptCompletionCommandReceipts.held_command_references.some((item) => item.requires_explicit_human_approval));
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-command-receipts", "summary.md"), "utf8"), /Human Review Cycle Receipt Completion Command Receipts/);
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-command-receipts", "index.html"), "utf8"), /Human Review Cycle Receipt Completion Command Receipts/);

      const humanReviewCycleReceiptCompletionCommandReceiptValidation = await runHumanReviewCycleReceiptCompletionCommandReceiptValidation({
        commandReceiptsPath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipts", "human-review-cycle-receipt-completion-command-receipts.json"),
        receiptInputPath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipts", "receipt-input-draft.json"),
        outDir: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-validation"),
        runAt: "2026-05-23T06:35:06.158Z",
      });
      const humanReviewCycleReceiptCompletionCommandReceiptValidationSchema = JSON.parse(await readFile("schemas/human-review-cycle-receipt-completion-command-receipt-validation.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReceiptCompletionCommandReceiptValidation, humanReviewCycleReceiptCompletionCommandReceiptValidationSchema, {}, "human_review_cycle_receipt_completion_command_receipt_validation"),
        [],
      );
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptValidation.validation_status, "pending_receipts");
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptValidation.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptValidation.summary.receipt_requirement_count, humanReviewCycleReceiptCompletionCommandReceipts.summary.receipt_requirement_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptValidation.summary.receipt_count, humanReviewCycleReceiptCompletionCommandReceipts.summary.receipt_draft_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptValidation.summary.validation_item_count, humanReviewCycleReceiptCompletionCommandReceipts.summary.receipt_draft_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptValidation.summary.pending_receipt_count, humanReviewCycleReceiptCompletionCommandReceipts.summary.receipt_draft_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptValidation.summary.ready_to_confirm_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptValidation.summary.error_count, 0);
      assert.ok(humanReviewCycleReceiptCompletionCommandReceiptValidation.validation_items.every((item) => item.validation_status === "pending_receipt"));
      assert.ok(humanReviewCycleReceiptCompletionCommandReceiptValidation.validation_items.every((item) => item.command_result === "not_run"));
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptValidation.validated_command_receipts.receipts.length, 0);
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-validation", "summary.md"), "utf8"), /Human Review Cycle Receipt Completion Command Receipt Validation/);

      const humanReviewCycleReceiptCompletionCommandReceiptFeedback = await runHumanReviewCycleReceiptCompletionCommandReceiptFeedback({
        commandReceiptValidationPath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-validation", "human-review-cycle-receipt-completion-command-receipt-validation.json"),
        commandReceiptsPath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipts", "human-review-cycle-receipt-completion-command-receipts.json"),
        commandQueuePath: path.join(outDir, "human-review-cycle-receipt-completion-command-queue", "human-review-cycle-receipt-completion-command-queue.json"),
        outDir: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-feedback"),
        runAt: "2026-05-23T06:35:06.159Z",
      });
      const humanReviewCycleReceiptCompletionCommandReceiptFeedbackSchema = JSON.parse(await readFile("schemas/human-review-cycle-receipt-completion-command-receipt-feedback.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReceiptCompletionCommandReceiptFeedback, humanReviewCycleReceiptCompletionCommandReceiptFeedbackSchema, {}, "human_review_cycle_receipt_completion_command_receipt_feedback"),
        [],
      );
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptFeedback.feedback_status, "pending_human_review");
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptFeedback.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptFeedback.safe_handling.feedback_only, true);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptFeedback.safe_handling.protected_actions_executed, false);
      assert.ok(humanReviewCycleReceiptCompletionCommandReceiptFeedback.summary.actor_feedback_count > 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptFeedback.summary.feedback_item_count, humanReviewCycleReceiptCompletionCommandReceiptValidation.summary.validation_item_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptFeedback.summary.pending_receipt_count, humanReviewCycleReceiptCompletionCommandReceiptValidation.summary.pending_receipt_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptFeedback.summary.ready_for_confirmation_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptFeedback.summary.validation_error_count, 0);
      assert.ok(humanReviewCycleReceiptCompletionCommandReceiptFeedback.feedback_items.every((item) => item.feedback_status === "needs_command_receipt"));
      assert.ok(humanReviewCycleReceiptCompletionCommandReceiptFeedback.feedback_items.every((item) => item.safe_handling.auto_execute_allowed === false));
      assert.ok(humanReviewCycleReceiptCompletionCommandReceiptFeedback.actor_feedback.some((actor) => actor.required_actor === "human_reviewer"));
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-feedback", "summary.md"), "utf8"), /Human Review Cycle Receipt Completion Command Receipt Feedback/);
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-feedback", "actors", "human_reviewer", "feedback.md"), "utf8"), /Command Receipt Feedback/);

      const humanReviewCycleReceiptCompletionCommandReceiptWorkspace = await runHumanReviewCycleReceiptCompletionCommandReceiptWorkspace({
        commandReceiptFeedbackPath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-feedback", "human-review-cycle-receipt-completion-command-receipt-feedback.json"),
        commandReceiptsPath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipts", "human-review-cycle-receipt-completion-command-receipts.json"),
        outDir: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-workspace"),
        runAt: "2026-05-23T06:35:06.160Z",
      });
      const humanReviewCycleReceiptCompletionCommandReceiptWorkspaceSchema = JSON.parse(await readFile("schemas/human-review-cycle-receipt-completion-command-receipt-workspace.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReceiptCompletionCommandReceiptWorkspace, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceSchema, {}, "human_review_cycle_receipt_completion_command_receipt_workspace"),
        [],
      );
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspace.workspace_status, "pending_human_review");
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspace.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspace.safe_handling.command_receipt_workspace_only, true);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspace.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspace.summary.actor_workspace_count, humanReviewCycleReceiptCompletionCommandReceiptFeedback.summary.actor_feedback_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspace.summary.workspace_item_count, humanReviewCycleReceiptCompletionCommandReceiptFeedback.summary.feedback_item_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspace.summary.receipt_row_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspace.summary.workspace_item_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspace.summary.pending_receipt_count, humanReviewCycleReceiptCompletionCommandReceiptFeedback.summary.pending_receipt_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspace.summary.ready_for_confirmation_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspace.summary.validation_error_count, 0);
      assert.ok(humanReviewCycleReceiptCompletionCommandReceiptWorkspace.workspace_items.every((item) => item.workspace_status === "needs_command_receipt"));
      assert.ok(humanReviewCycleReceiptCompletionCommandReceiptWorkspace.workspace_items.every((item) => item.editable_receipt.commands_run.includes(item.command)));
      assert.ok(humanReviewCycleReceiptCompletionCommandReceiptWorkspace.actor_workspaces.some((actor) => actor.required_actor === "human_reviewer"));
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-workspace", "summary.md"), "utf8"), /Human Review Cycle Receipt Completion Command Receipt Workspace/);
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-workspace", "actors", "human_reviewer", "workspace.md"), "utf8"), /Command Receipt Workspace/);
      const actorCommandReceiptInput = JSON.parse(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-workspace", "actors", "human_reviewer", "receipt-input.json"), "utf8"));
      assert.equal(actorCommandReceiptInput.schema_version, "human-review-cycle-receipt-completion-command-receipts-input.v1");
      assert.equal(actorCommandReceiptInput.receipts.length, humanReviewCycleReceiptCompletionCommandReceiptWorkspace.summary.receipt_row_count);

      const humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge = await runHumanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge({
        workspacePath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-workspace", "human-review-cycle-receipt-completion-command-receipt-workspace.json"),
        outDir: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-workspace-merge"),
        runAt: "2026-05-23T06:35:06.161Z",
      });
      const humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMergeSchema = JSON.parse(await readFile("schemas/human-review-cycle-receipt-completion-command-receipt-workspace-merge.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMergeSchema, {}, "human_review_cycle_receipt_completion_command_receipt_workspace_merge"),
        [],
      );
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.merge_status, "pending_human_review");
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.safe_handling.command_receipt_workspace_merge_only, true);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.summary.actor_input_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspace.summary.actor_workspace_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.summary.merge_item_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspace.summary.workspace_item_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.summary.receipt_row_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspace.summary.receipt_row_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.summary.pending_receipt_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspace.summary.pending_receipt_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.summary.ready_for_validation_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.summary.validation_error_count, 0);
      assert.ok(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.merge_items.every((item) => item.merge_status === "pending_receipt"));
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.receipt_input.schema_version, "human-review-cycle-receipt-completion-command-receipts-input.v1");
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.receipt_input.receipts.length, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.summary.receipt_row_count);
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-workspace-merge", "summary.md"), "utf8"), /Human Review Cycle Receipt Completion Command Receipt Workspace Merge/);

      const humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidation = await runHumanReviewCycleReceiptCompletionCommandReceiptValidation({
        commandReceiptsPath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipts", "human-review-cycle-receipt-completion-command-receipts.json"),
        receiptInputPath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-workspace-merge", "receipt-input.json"),
        outDir: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-workspace-validation"),
        runAt: "2026-05-23T06:35:06.162Z",
      });
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidation, humanReviewCycleReceiptCompletionCommandReceiptValidationSchema, {}, "human_review_cycle_receipt_completion_command_receipt_workspace_validation"),
        [],
      );
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidation.validation_status, "pending_receipts");
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidation.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidation.summary.receipt_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.summary.receipt_row_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidation.summary.validation_item_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.summary.merge_item_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidation.summary.pending_receipt_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.summary.pending_receipt_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidation.summary.ready_to_confirm_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidation.summary.error_count, 0);
      assert.ok(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidation.validation_items.every((item) => item.validation_status === "pending_receipt"));
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidation.validated_command_receipts.receipts.length, 0);
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-workspace-validation", "summary.md"), "utf8"), /Human Review Cycle Receipt Completion Command Receipt Validation/);

      const humanReviewCycleReceiptCompletionCommandReceiptApplication = await runHumanReviewCycleReceiptCompletionCommandReceiptApplication({
        commandReceiptValidationPath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-workspace-validation", "human-review-cycle-receipt-completion-command-receipt-validation.json"),
        commandQueuePath: path.join(outDir, "human-review-cycle-receipt-completion-command-queue", "human-review-cycle-receipt-completion-command-queue.json"),
        outDir: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-application"),
        runAt: "2026-05-23T06:35:06.163Z",
      });
      const humanReviewCycleReceiptCompletionCommandReceiptApplicationSchema = JSON.parse(await readFile("schemas/human-review-cycle-receipt-completion-command-receipt-application.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReceiptCompletionCommandReceiptApplication, humanReviewCycleReceiptCompletionCommandReceiptApplicationSchema, {}, "human_review_cycle_receipt_completion_command_receipt_application"),
        [],
      );
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptApplication.application_status, "nothing_to_apply");
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptApplication.safe_to_apply, false);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptApplication.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptApplication.safe_handling.refresh_commands_executed, false);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptApplication.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptApplication.summary.ready_receipt_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptApplication.summary.pending_receipt_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidation.summary.pending_receipt_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptApplication.summary.applied_receipt_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptApplication.summary.patched_command_queue_item_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptApplication.summary.audit_event_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptApplication.summary.refresh_command_executed_by_harness_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptApplication.summary.protected_action_executed_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptApplication.applied_command_receipts.length, 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptApplication.pending_command_receipts.length, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidation.summary.pending_receipt_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandReceiptApplication.audit_events.length, 0);
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-application", "summary.md"), "utf8"), /Human Review Cycle Receipt Completion Command Receipt Application/);

      const humanReviewCycleReceiptCompletionReconciliation = await runHumanReviewCycleReceiptCompletionReconciliation({
        completionReadinessPath: path.join(outDir, "human-review-cycle-receipt-completion-readiness", "human-review-cycle-receipt-completion-readiness.json"),
        commandQueuePath: path.join(outDir, "human-review-cycle-receipt-completion-command-queue", "human-review-cycle-receipt-completion-command-queue.json"),
        commandReceiptApplicationPath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-application", "human-review-cycle-receipt-completion-command-receipt-application.json"),
        outDir: path.join(outDir, "human-review-cycle-receipt-completion-reconciliation"),
        runAt: "2026-05-23T06:35:06.164Z",
      });
      const humanReviewCycleReceiptCompletionReconciliationSchema = JSON.parse(await readFile("schemas/human-review-cycle-receipt-completion-reconciliation.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReceiptCompletionReconciliation, humanReviewCycleReceiptCompletionReconciliationSchema, {}, "human_review_cycle_receipt_completion_reconciliation"),
        [],
      );
      assert.equal(humanReviewCycleReceiptCompletionReconciliation.reconciliation_status, "waiting_for_manual_command_receipts");
      assert.equal(humanReviewCycleReceiptCompletionReconciliation.safe_handling.auto_execute_allowed, false);
      assert.equal(humanReviewCycleReceiptCompletionReconciliation.safe_handling.reconciliation_only, true);
      assert.equal(humanReviewCycleReceiptCompletionReconciliation.safe_handling.refresh_commands_executed, false);
      assert.equal(humanReviewCycleReceiptCompletionReconciliation.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewCycleReceiptCompletionReconciliation.summary.pending_command_receipt_count, humanReviewCycleReceiptCompletionCommandReceiptApplication.summary.pending_receipt_count);
      assert.equal(humanReviewCycleReceiptCompletionReconciliation.summary.applied_command_receipt_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionReconciliation.summary.held_command_count, humanReviewCycleReceiptCompletionCommandQueue.summary.held_command_item_count);
      assert.equal(humanReviewCycleReceiptCompletionReconciliation.summary.protected_held_command_count, humanReviewCycleReceiptCompletionCommandQueue.summary.protected_held_command_count);
      assert.equal(humanReviewCycleReceiptCompletionReconciliation.summary.pending_human_input_count, humanReviewCycleReceiptCompletionReadiness.summary.pending_human_input_count);
      assert.equal(humanReviewCycleReceiptCompletionReconciliation.summary.validation_error_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionReconciliation.summary.refresh_command_executed_by_harness_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionReconciliation.summary.protected_action_executed_count, 0);
      assert.ok(humanReviewCycleReceiptCompletionReconciliation.reconciliation_items.some((item) => item.reconciliation_status === "waiting_for_manual_command_receipt"));
      assert.ok(humanReviewCycleReceiptCompletionReconciliation.reconciliation_items.some((item) => item.reconciliation_status === "waiting_for_explicit_human_approval"));
      assert.equal(humanReviewCycleReceiptCompletionReconciliation.actor_statuses.length, humanReviewCycleReceiptCompletionCommandQueue.summary.actor_command_queue_count);
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-reconciliation", "summary.md"), "utf8"), /Human Review Cycle Receipt Completion Reconciliation/);

      const humanReviewCycleReceiptCompletionBaseline = await runHumanReviewCycleReceiptCompletionBaseline({
        reconciliationPath: path.join(outDir, "human-review-cycle-receipt-completion-reconciliation", "human-review-cycle-receipt-completion-reconciliation.json"),
        outDir: path.join(outDir, "human-review-cycle-receipt-completion-baseline"),
        runAt: "2026-05-23T06:35:06.165Z",
      });
      const humanReviewCycleReceiptCompletionBaselineSchema = JSON.parse(await readFile("schemas/human-review-cycle-receipt-completion-baseline.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReceiptCompletionBaseline, humanReviewCycleReceiptCompletionBaselineSchema, {}, "human_review_cycle_receipt_completion_baseline"),
        [],
      );
      assert.equal(humanReviewCycleReceiptCompletionBaseline.baseline_status, "frozen_with_blockers");
      assert.equal(humanReviewCycleReceiptCompletionBaseline.summary.blocker_count, humanReviewCycleReceiptCompletionReconciliation.summary.blocked_follow_on_count);
      assert.equal(humanReviewCycleReceiptCompletionBaseline.summary.pending_command_receipt_count, humanReviewCycleReceiptCompletionReconciliation.summary.pending_command_receipt_count);
      assert.equal(humanReviewCycleReceiptCompletionBaseline.summary.held_command_count, humanReviewCycleReceiptCompletionReconciliation.summary.held_command_count);
      assert.equal(humanReviewCycleReceiptCompletionBaseline.summary.protected_hold_count, humanReviewCycleReceiptCompletionReconciliation.summary.protected_held_command_count);
      assert.equal(humanReviewCycleReceiptCompletionBaseline.summary.mismatched_count_check_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionBaseline.summary.refresh_command_executed_by_harness_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionBaseline.summary.protected_action_executed_count, 0);
      assert.ok(humanReviewCycleReceiptCompletionBaseline.blocker_inventory.every((blocker) => String(blocker.blocker_status).startsWith("waiting_for")));
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-baseline", "summary.md"), "utf8"), /Human Review Cycle Receipt Completion Baseline/);

      const humanReviewCycleReceiptCompletionManualCommandReceiptPack = await runHumanReviewCycleReceiptCompletionManualCommandReceiptPack({
        baselinePath: path.join(outDir, "human-review-cycle-receipt-completion-baseline", "human-review-cycle-receipt-completion-baseline.json"),
        commandReceiptWorkspacePath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-workspace", "human-review-cycle-receipt-completion-command-receipt-workspace.json"),
        outDir: path.join(outDir, "human-review-cycle-receipt-completion-manual-command-receipt-pack"),
        runAt: "2026-05-23T06:35:06.166Z",
      });
      const humanReviewCycleReceiptCompletionManualCommandReceiptPackSchema = JSON.parse(await readFile("schemas/human-review-cycle-receipt-completion-manual-command-receipt-pack.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReceiptCompletionManualCommandReceiptPack, humanReviewCycleReceiptCompletionManualCommandReceiptPackSchema, {}, "human_review_cycle_receipt_completion_manual_command_receipt_pack"),
        [],
      );
      assert.equal(humanReviewCycleReceiptCompletionManualCommandReceiptPack.pack_status, "ready_for_manual_receipts");
      assert.equal(humanReviewCycleReceiptCompletionManualCommandReceiptPack.summary.receipt_pack_item_count, humanReviewCycleReceiptCompletionBaseline.summary.pending_command_receipt_count);
      assert.equal(humanReviewCycleReceiptCompletionManualCommandReceiptPack.summary.non_receipt_blocker_count, humanReviewCycleReceiptCompletionBaseline.summary.held_command_count);
      assert.equal(humanReviewCycleReceiptCompletionManualCommandReceiptPack.summary.missing_target_receipt_path_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionManualCommandReceiptPack.summary.missing_required_field_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionManualCommandReceiptPack.summary.refresh_command_executed_by_harness_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionManualCommandReceiptPack.summary.protected_action_executed_count, 0);
      assert.ok(humanReviewCycleReceiptCompletionManualCommandReceiptPack.actor_receipt_packs.every((pack) => pack.target_receipt_input_path && pack.required_receipt_fields.length > 0));
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-manual-command-receipt-pack", "summary.md"), "utf8"), /Human Review Cycle Receipt Completion Manual Command Receipt Pack/);

      const humanReviewCycleReceiptCompletionHeldCommandResolution = await runHumanReviewCycleReceiptCompletionHeldCommandResolution({
        baselinePath: path.join(outDir, "human-review-cycle-receipt-completion-baseline", "human-review-cycle-receipt-completion-baseline.json"),
        manualCommandReceiptPackPath: path.join(outDir, "human-review-cycle-receipt-completion-manual-command-receipt-pack", "human-review-cycle-receipt-completion-manual-command-receipt-pack.json"),
        commandQueuePath: path.join(outDir, "human-review-cycle-receipt-completion-command-queue", "human-review-cycle-receipt-completion-command-queue.json"),
        outDir: path.join(outDir, "human-review-cycle-receipt-completion-held-command-resolution"),
        runAt: "2026-05-23T06:35:06.167Z",
      });
      const humanReviewCycleReceiptCompletionHeldCommandResolutionSchema = JSON.parse(await readFile("schemas/human-review-cycle-receipt-completion-held-command-resolution.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReceiptCompletionHeldCommandResolution, humanReviewCycleReceiptCompletionHeldCommandResolutionSchema, {}, "human_review_cycle_receipt_completion_held_command_resolution"),
        [],
      );
      assert.equal(humanReviewCycleReceiptCompletionHeldCommandResolution.resolution_status, "ready_for_actor_resolution");
      assert.equal(humanReviewCycleReceiptCompletionHeldCommandResolution.summary.resolution_plan_count, humanReviewCycleReceiptCompletionBaseline.summary.held_command_count);
      assert.equal(humanReviewCycleReceiptCompletionHeldCommandResolution.summary.command_queue_held_item_count, humanReviewCycleReceiptCompletionCommandQueue.summary.held_command_item_count);
      assert.equal(humanReviewCycleReceiptCompletionHeldCommandResolution.summary.manual_pack_non_receipt_blocker_count, humanReviewCycleReceiptCompletionManualCommandReceiptPack.summary.non_receipt_blocker_count);
      assert.equal(humanReviewCycleReceiptCompletionHeldCommandResolution.summary.missing_required_actor_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionHeldCommandResolution.summary.missing_unblock_condition_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionHeldCommandResolution.summary.missing_follow_on_action_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionHeldCommandResolution.summary.refresh_command_executed_by_harness_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionHeldCommandResolution.summary.protected_action_executed_count, 0);
      assert.ok(humanReviewCycleReceiptCompletionHeldCommandResolution.resolution_plans.every((plan) => plan.required_actor && plan.unblock_condition?.condition_id && plan.follow_on_action?.command));
      assert.ok(humanReviewCycleReceiptCompletionHeldCommandResolution.resolution_plans.some((plan) => plan.requires_explicit_human_approval && plan.unblock_condition.condition_type === "explicit_human_approval"));
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-held-command-resolution", "summary.md"), "utf8"), /Human Review Cycle Receipt Completion Held Command Resolution/);

      const humanReviewCycleReceiptCompletionProtectedApprovalRequestPack = await runHumanReviewCycleReceiptCompletionProtectedApprovalRequestPack({
        heldCommandResolutionPath: path.join(outDir, "human-review-cycle-receipt-completion-held-command-resolution", "human-review-cycle-receipt-completion-held-command-resolution.json"),
        outDir: path.join(outDir, "human-review-cycle-receipt-completion-protected-approval-request-pack"),
        runAt: "2026-05-23T06:35:06.168Z",
      });
      const humanReviewCycleReceiptCompletionProtectedApprovalRequestPackSchema = JSON.parse(await readFile("schemas/human-review-cycle-receipt-completion-protected-approval-request-pack.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReceiptCompletionProtectedApprovalRequestPack, humanReviewCycleReceiptCompletionProtectedApprovalRequestPackSchema, {}, "human_review_cycle_receipt_completion_protected_approval_request_pack"),
        [],
      );
      assert.equal(humanReviewCycleReceiptCompletionProtectedApprovalRequestPack.pack_status, "ready_for_explicit_approval");
      assert.equal(humanReviewCycleReceiptCompletionProtectedApprovalRequestPack.summary.approval_request_count, humanReviewCycleReceiptCompletionHeldCommandResolution.summary.protected_resolution_count);
      assert.equal(humanReviewCycleReceiptCompletionProtectedApprovalRequestPack.summary.protected_action_request_count, humanReviewCycleReceiptCompletionHeldCommandResolution.summary.protected_resolution_count);
      assert.equal(humanReviewCycleReceiptCompletionProtectedApprovalRequestPack.summary.pending_explicit_approval_count, humanReviewCycleReceiptCompletionProtectedApprovalRequestPack.summary.approval_request_count);
      assert.equal(humanReviewCycleReceiptCompletionProtectedApprovalRequestPack.summary.actor_approval_pack_count, 1);
      assert.equal(humanReviewCycleReceiptCompletionProtectedApprovalRequestPack.summary.command_receipt_mixed_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionProtectedApprovalRequestPack.summary.non_protected_request_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionProtectedApprovalRequestPack.summary.missing_target_approval_input_path_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionProtectedApprovalRequestPack.summary.missing_required_approval_field_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionProtectedApprovalRequestPack.summary.refresh_command_executed_by_harness_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionProtectedApprovalRequestPack.summary.protected_action_executed_count, 0);
      assert.ok(humanReviewCycleReceiptCompletionProtectedApprovalRequestPack.approval_requests.every((request) => request.protected_action && request.approval_status === "pending_explicit_approval" && request.separated_from_command_receipts));
      assert.ok(humanReviewCycleReceiptCompletionProtectedApprovalRequestPack.actor_approval_packs.every((pack) => pack.target_approval_input_path && pack.required_approval_fields.length > 0));
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-protected-approval-request-pack", "summary.md"), "utf8"), /Human Review Cycle Receipt Completion Protected Approval Request Pack/);

      const humanReviewCycleReceiptCompletionManualRevalidation = await runHumanReviewCycleReceiptCompletionManualRevalidation({
        manualCommandReceiptPackPath: path.join(outDir, "human-review-cycle-receipt-completion-manual-command-receipt-pack", "human-review-cycle-receipt-completion-manual-command-receipt-pack.json"),
        commandReceiptWorkspaceMergePath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-workspace-merge", "human-review-cycle-receipt-completion-command-receipt-workspace-merge.json"),
        commandReceiptWorkspaceValidationPath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-workspace-validation", "human-review-cycle-receipt-completion-command-receipt-validation.json"),
        commandReceiptApplicationPath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-application", "human-review-cycle-receipt-completion-command-receipt-application.json"),
        protectedApprovalRequestPackPath: path.join(outDir, "human-review-cycle-receipt-completion-protected-approval-request-pack", "human-review-cycle-receipt-completion-protected-approval-request-pack.json"),
        outDir: path.join(outDir, "human-review-cycle-receipt-completion-manual-revalidation"),
        runAt: "2026-05-23T06:35:06.169Z",
      });
      const humanReviewCycleReceiptCompletionManualRevalidationSchema = JSON.parse(await readFile("schemas/human-review-cycle-receipt-completion-manual-revalidation.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReceiptCompletionManualRevalidation, humanReviewCycleReceiptCompletionManualRevalidationSchema, {}, "human_review_cycle_receipt_completion_manual_revalidation"),
        [],
      );
      assert.equal(humanReviewCycleReceiptCompletionManualRevalidation.revalidation_status, "waiting_for_human_receipts");
      assert.equal(humanReviewCycleReceiptCompletionManualRevalidation.summary.revalidation_item_count, humanReviewCycleReceiptCompletionManualCommandReceiptPack.summary.receipt_pack_item_count);
      assert.equal(humanReviewCycleReceiptCompletionManualRevalidation.summary.source_pack_item_count, humanReviewCycleReceiptCompletionManualCommandReceiptPack.summary.receipt_pack_item_count);
      assert.equal(humanReviewCycleReceiptCompletionManualRevalidation.summary.pending_human_receipt_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidation.summary.pending_receipt_count);
      assert.equal(humanReviewCycleReceiptCompletionManualRevalidation.summary.human_entered_ready_receipt_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionManualRevalidation.summary.human_entered_applied_receipt_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionManualRevalidation.summary.ready_or_applied_candidate_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionManualRevalidation.summary.non_human_ready_or_applied_candidate_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionManualRevalidation.summary.protected_approval_overlap_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionManualRevalidation.summary.auto_executed_receipt_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionManualRevalidation.summary.refresh_command_executed_by_harness_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionManualRevalidation.summary.protected_action_executed_count, 0);
      assert.ok(humanReviewCycleReceiptCompletionManualRevalidation.revalidation_items.every((item) => !item.ready_or_applied_candidate || item.human_entered_receipt));
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-manual-revalidation", "summary.md"), "utf8"), /Human Review Cycle Receipt Completion Manual Revalidation/);

      const humanReviewCycleReceiptCompletionCommandQueuePatchProjection = await runHumanReviewCycleReceiptCompletionCommandQueuePatchProjection({
        commandQueuePath: path.join(outDir, "human-review-cycle-receipt-completion-command-queue", "human-review-cycle-receipt-completion-command-queue.json"),
        manualRevalidationPath: path.join(outDir, "human-review-cycle-receipt-completion-manual-revalidation", "human-review-cycle-receipt-completion-manual-revalidation.json"),
        commandReceiptApplicationPath: path.join(outDir, "human-review-cycle-receipt-completion-command-receipt-application", "human-review-cycle-receipt-completion-command-receipt-application.json"),
        outDir: path.join(outDir, "human-review-cycle-receipt-completion-command-queue-patch-projection"),
        runAt: "2026-05-23T06:35:06.170Z",
      });
      const humanReviewCycleReceiptCompletionCommandQueuePatchProjectionSchema = JSON.parse(await readFile("schemas/human-review-cycle-receipt-completion-command-queue-patch-projection.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReceiptCompletionCommandQueuePatchProjection, humanReviewCycleReceiptCompletionCommandQueuePatchProjectionSchema, {}, "human_review_cycle_receipt_completion_command_queue_patch_projection"),
        [],
      );
      assert.equal(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.projection_status, "waiting_for_human_receipts");
      assert.equal(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.safe_handling.patch_projection_only, true);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.safe_handling.command_queue_patch_applied, false);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.safe_handling.audit_events_emitted, false);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.projection_item_count, humanReviewCycleReceiptCompletionManualRevalidation.summary.revalidation_item_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.source_revalidation_item_count, humanReviewCycleReceiptCompletionManualRevalidation.summary.revalidation_item_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.patch_target_count, humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.projection_item_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.ready_patch_count, humanReviewCycleReceiptCompletionManualRevalidation.summary.ready_or_applied_candidate_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.waiting_patch_count, humanReviewCycleReceiptCompletionManualRevalidation.summary.pending_human_receipt_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.patch_operation_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.audit_event_candidate_count, humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.projection_item_count);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.emittable_audit_event_candidate_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.missing_queue_item_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.non_human_patch_candidate_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.protected_overlap_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.auto_executed_receipt_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.patch_applied_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.audit_event_emitted_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.command_executed_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.refresh_command_executed_by_harness_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.protected_action_executed_count, 0);
      assert.ok(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.projection_items.every((item) => item.before_state && item.after_state && item.audit_event_candidate));
      assert.ok(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.projection_items.every((item) => item.projection_status === "waiting_for_human_receipt"));
      assert.ok(humanReviewCycleReceiptCompletionCommandQueuePatchProjection.audit_event_candidates.every((event) => event.event_status === "held_pending_manual_receipt" && !event.emitted));
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-command-queue-patch-projection", "summary.md"), "utf8"), /Human Review Cycle Receipt Completion Command Queue Patch Projection/);

      const humanReviewCycleReceiptCompletionCloseoutLedger = await runHumanReviewCycleReceiptCompletionCloseoutLedger({
        baselinePath: path.join(outDir, "human-review-cycle-receipt-completion-baseline", "human-review-cycle-receipt-completion-baseline.json"),
        manualRevalidationPath: path.join(outDir, "human-review-cycle-receipt-completion-manual-revalidation", "human-review-cycle-receipt-completion-manual-revalidation.json"),
        protectedApprovalRequestPackPath: path.join(outDir, "human-review-cycle-receipt-completion-protected-approval-request-pack", "human-review-cycle-receipt-completion-protected-approval-request-pack.json"),
        commandQueuePatchProjectionPath: path.join(outDir, "human-review-cycle-receipt-completion-command-queue-patch-projection", "human-review-cycle-receipt-completion-command-queue-patch-projection.json"),
        heldCommandResolutionPath: path.join(outDir, "human-review-cycle-receipt-completion-held-command-resolution", "human-review-cycle-receipt-completion-held-command-resolution.json"),
        outDir: path.join(outDir, "human-review-cycle-receipt-completion-closeout-ledger"),
        runAt: "2026-05-23T06:35:06.171Z",
      });
      const humanReviewCycleReceiptCompletionCloseoutLedgerSchema = JSON.parse(await readFile("schemas/human-review-cycle-receipt-completion-closeout-ledger.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewCycleReceiptCompletionCloseoutLedger, humanReviewCycleReceiptCompletionCloseoutLedgerSchema, {}, "human_review_cycle_receipt_completion_closeout_ledger"),
        [],
      );
      assert.equal(humanReviewCycleReceiptCompletionCloseoutLedger.closeout_status, "open_pending");
      assert.equal(humanReviewCycleReceiptCompletionCloseoutLedger.safe_handling.closeout_ledger_only, true);
      assert.equal(humanReviewCycleReceiptCompletionCloseoutLedger.safe_handling.command_queue_patch_applied, false);
      assert.equal(humanReviewCycleReceiptCompletionCloseoutLedger.safe_handling.audit_events_emitted, false);
      assert.equal(humanReviewCycleReceiptCompletionCloseoutLedger.summary.closeout_item_count, humanReviewCycleReceiptCompletionBaseline.summary.blocker_count);
      assert.equal(humanReviewCycleReceiptCompletionCloseoutLedger.summary.source_baseline_blocker_count, humanReviewCycleReceiptCompletionBaseline.summary.blocker_count);
      assert.equal(humanReviewCycleReceiptCompletionCloseoutLedger.summary.pending_count, humanReviewCycleReceiptCompletionCloseoutLedger.summary.closeout_item_count);
      assert.equal(humanReviewCycleReceiptCompletionCloseoutLedger.summary.approved_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCloseoutLedger.summary.rejected_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCloseoutLedger.summary.superseded_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCloseoutLedger.summary.normalized_status_total_count, humanReviewCycleReceiptCompletionCloseoutLedger.summary.closeout_item_count);
      assert.equal(humanReviewCycleReceiptCompletionCloseoutLedger.summary.unknown_status_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCloseoutLedger.summary.pending_command_receipt_count, humanReviewCycleReceiptCompletionBaseline.summary.pending_command_receipt_count);
      assert.equal(humanReviewCycleReceiptCompletionCloseoutLedger.summary.pending_held_command_count, humanReviewCycleReceiptCompletionBaseline.summary.held_command_count);
      assert.equal(humanReviewCycleReceiptCompletionCloseoutLedger.summary.pending_protected_approval_count, humanReviewCycleReceiptCompletionProtectedApprovalRequestPack.summary.pending_explicit_approval_count);
      assert.equal(humanReviewCycleReceiptCompletionCloseoutLedger.summary.actor_closeout_count, 2);
      assert.equal(humanReviewCycleReceiptCompletionCloseoutLedger.summary.validation_error_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCloseoutLedger.summary.patch_applied_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCloseoutLedger.summary.audit_event_emitted_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCloseoutLedger.summary.command_executed_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCloseoutLedger.summary.refresh_command_executed_by_harness_count, 0);
      assert.equal(humanReviewCycleReceiptCompletionCloseoutLedger.summary.protected_action_executed_count, 0);
      assert.deepEqual(humanReviewCycleReceiptCompletionCloseoutLedger.normalized_blocker_statuses.map((status) => status.normalized_status), ["pending", "approved", "rejected", "superseded"]);
      assert.ok(humanReviewCycleReceiptCompletionCloseoutLedger.closeout_items.every((item) => ["pending", "approved", "rejected", "superseded"].includes(item.normalized_status)));
      assert.ok(humanReviewCycleReceiptCompletionCloseoutLedger.actor_closeouts.every((actorCloseout) => actorCloseout.closeout_status === "pending" && actorCloseout.closeout_item_count > 0));
      assert.match(await readFile(path.join(outDir, "human-review-cycle-receipt-completion-closeout-ledger", "summary.md"), "utf8"), /Human Review Cycle Receipt Completion Closeout Ledger/);

      const controlPlaneHumanGateReceiptApplication = await runControlPlaneHumanGateReceiptApplication({
        validationPath: path.join(outDir, "control-plane-human-gate-receipt-validation", "control-plane-human-gate-receipt-validation.json"),
        humanGatesPath: path.join(outDir, "control-plane-human-gates", "control-plane-human-gates.json"),
        outDir: path.join(outDir, "control-plane-human-gate-receipt-application"),
        runAt: "2026-05-23T06:35:06.165Z",
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

      const eventAuditRunContractFreeze = await runEventAuditRunContractFreeze({
        observabilityCatalogPath: path.join(outDir, "observability", "observability-catalog.json"),
        controlPlaneAuditTrailPath: path.join(outDir, "control-plane-audit-trail", "control-plane-audit-trail.json"),
        capabilityWorkflowContractFreezePath: path.join(outDir, "capability-workflow-contract-freeze", "capability-workflow-contract-freeze.json"),
        runtimeAgentRunContractFreezePath: path.join(outDir, "runtime-agentrun-contract-freeze", "runtime-agentrun-contract-freeze.json"),
        gateApprovalContractFreezePath: path.join(outDir, "gate-approval-contract-freeze", "gate-approval-contract-freeze.json"),
        outputDeliveryContractFreezePath: path.join(outDir, "output-delivery-contract-freeze", "output-delivery-contract-freeze.json"),
        outDir: path.join(outDir, "event-audit-run-contract-freeze"),
        runAt: "2026-05-23T06:35:07.750Z",
      });
      const eventAuditRunContractFreezeSchema = JSON.parse(await readFile("schemas/event-audit-run-contract-freeze.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(eventAuditRunContractFreeze, eventAuditRunContractFreezeSchema, {}, "event_audit_run_contract_freeze"),
        [],
      );
      assert.equal(eventAuditRunContractFreeze.summary.freeze_status, "complete");
      assert.equal(eventAuditRunContractFreeze.summary.event_record_count, observabilityCatalog.summary.event_count);
      assert.equal(eventAuditRunContractFreeze.summary.run_ledger_count, observabilityCatalog.summary.run_ledger_count);
      assert.equal(eventAuditRunContractFreeze.summary.audit_event_count, controlPlaneAuditTrail.summary.audit_event_count);
      assert.equal(
        eventAuditRunContractFreeze.summary.correlation_id_count,
        eventAuditRunContractFreeze.summary.event_record_count + eventAuditRunContractFreeze.summary.audit_event_count + eventAuditRunContractFreeze.summary.run_ledger_count,
      );
      assert.equal(eventAuditRunContractFreeze.summary.missing_correlation_id_count, 0);
      assert.equal(eventAuditRunContractFreeze.summary.missing_actor_count, 0);
      assert.equal(eventAuditRunContractFreeze.summary.missing_policy_snapshot_count, 0);
      assert.equal(eventAuditRunContractFreeze.summary.run_with_event_count, eventAuditRunContractFreeze.summary.run_ledger_count);
      assert.equal(eventAuditRunContractFreeze.summary.run_with_agent_count, eventAuditRunContractFreeze.summary.run_ledger_count);
      assert.equal(eventAuditRunContractFreeze.summary.validation_error_count, 0);
      assert.equal(eventAuditRunContractFreeze.event_audit_run_contract.event_records[0].schema_version, "event-record.v2");
      assert.equal(eventAuditRunContractFreeze.event_audit_run_contract.audit_events[0].schema_version, "audit-event.v2");
      assert.equal(eventAuditRunContractFreeze.event_audit_run_contract.run_ledgers[0].schema_version, "run-ledger.v2");
      assert.equal(eventAuditRunContractFreeze.event_audit_run_contract.event_run_bindings[0].schema_version, "event-run-binding.v2");
      assert.ok(eventAuditRunContractFreeze.event_audit_run_contract.event_records.every((event) => event.correlation_id && event.policy_snapshot_id && event.actor?.actor_id));
      assert.ok(eventAuditRunContractFreeze.event_audit_run_contract.audit_events.every((event) => event.correlation_id && event.policy_snapshot_id && event.actor?.actor_id));
      assert.ok(eventAuditRunContractFreeze.event_audit_run_contract.run_ledgers.every((run) => run.event_ids.length > 0 && run.agent_run_ids.length > 0));
      assert.ok(eventAuditRunContractFreeze.event_audit_run_contract.event_run_bindings.every((binding) => ["linked", "external_control_event"].includes(binding.binding_status)));
      assert.ok(eventAuditRunContractFreeze.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "event-audit-run-contract-freeze", "summary.md"), "utf8"), /Event\/Audit\/Run Ledger Contract Freeze/);

      const policySnapshotBindingLedger = await runPolicySnapshotBindingLedger({
        policySnapshotLedgerPath: path.join(outDir, "policy-snapshots", "policy-snapshot-ledger.json"),
        capabilityWorkflowContractFreezePath: path.join(outDir, "capability-workflow-contract-freeze", "capability-workflow-contract-freeze.json"),
        runtimeAgentRunContractFreezePath: path.join(outDir, "runtime-agentrun-contract-freeze", "runtime-agentrun-contract-freeze.json"),
        gateApprovalContractFreezePath: path.join(outDir, "gate-approval-contract-freeze", "gate-approval-contract-freeze.json"),
        outputDeliveryContractFreezePath: path.join(outDir, "output-delivery-contract-freeze", "output-delivery-contract-freeze.json"),
        eventAuditRunContractFreezePath: path.join(outDir, "event-audit-run-contract-freeze", "event-audit-run-contract-freeze.json"),
        approvalAuthorityLedgerPath: path.join(outDir, "approval-authority", "approval-authority-ledger.json"),
        outDir: path.join(outDir, "policy-snapshot-bindings"),
        runAt: "2026-05-23T06:35:07.775Z",
      });
      const policySnapshotBindingLedgerSchema = JSON.parse(await readFile("schemas/policy-snapshot-binding-ledger.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(policySnapshotBindingLedger, policySnapshotBindingLedgerSchema, {}, "policy_snapshot_binding_ledger"),
        [],
      );
      const expectedPolicyBindingCount =
        capabilityWorkflowContractFreeze.summary.workflow_run_count
        + runtimeAgentRunContractFreeze.summary.agent_run_count
        + eventAuditRunContractFreeze.summary.event_record_count
        + eventAuditRunContractFreeze.summary.audit_event_count
        + eventAuditRunContractFreeze.summary.run_ledger_count
        + gateApprovalContractFreeze.summary.gate_result_count
        + gateApprovalContractFreeze.summary.approval_request_count
        + outputDeliveryContractFreeze.summary.output_artifact_count
        + outputDeliveryContractFreeze.summary.delivery_action_count;
      assert.equal(policySnapshotBindingLedger.summary.policy_snapshot_binding_status, "complete");
      assert.equal(policySnapshotBindingLedger.summary.workflow_policy_binding_count, capabilityWorkflowContractFreeze.summary.workflow_run_count);
      assert.equal(policySnapshotBindingLedger.summary.agent_run_policy_binding_count, runtimeAgentRunContractFreeze.summary.agent_run_count);
      assert.equal(
        policySnapshotBindingLedger.summary.event_policy_binding_count,
        eventAuditRunContractFreeze.summary.event_record_count + eventAuditRunContractFreeze.summary.audit_event_count + eventAuditRunContractFreeze.summary.run_ledger_count,
      );
      assert.equal(policySnapshotBindingLedger.summary.gate_policy_binding_count, gateApprovalContractFreeze.summary.gate_result_count);
      assert.equal(policySnapshotBindingLedger.summary.approval_policy_binding_count, gateApprovalContractFreeze.summary.approval_request_count);
      assert.equal(
        policySnapshotBindingLedger.summary.output_policy_binding_count,
        outputDeliveryContractFreeze.summary.output_artifact_count + outputDeliveryContractFreeze.summary.delivery_action_count,
      );
      assert.equal(policySnapshotBindingLedger.summary.policy_snapshot_binding_count, expectedPolicyBindingCount);
      assert.equal(policySnapshotBindingLedger.summary.known_policy_snapshot_binding_count, expectedPolicyBindingCount);
      assert.equal(policySnapshotBindingLedger.summary.missing_policy_snapshot_count, 0);
      assert.equal(policySnapshotBindingLedger.summary.unresolved_policy_snapshot_count, 0);
      assert.ok(policySnapshotBindingLedger.summary.fallback_resolved_binding_count > 0);
      assert.equal(policySnapshotBindingLedger.summary.unresolved_declared_reference_count, eventAuditRunContractFreeze.summary.fallback_policy_snapshot_count);
      assert.equal(policySnapshotBindingLedger.summary.validation_error_count, 0);
      assert.ok(policySnapshotBindingLedger.policy_snapshot_binding_catalog.workflow_policy_bindings.every((binding) => binding.binding_status === "bound" && binding.policy_snapshot_known));
      assert.ok(policySnapshotBindingLedger.policy_snapshot_binding_catalog.agent_run_policy_bindings.every((binding) => binding.binding_status === "bound" && binding.policy_snapshot_known));
      assert.ok(policySnapshotBindingLedger.policy_snapshot_binding_catalog.event_policy_bindings.every((binding) => binding.binding_status === "bound" && binding.policy_snapshot_known));
      assert.ok(policySnapshotBindingLedger.policy_snapshot_binding_catalog.gate_policy_bindings.every((binding) => binding.binding_status === "bound" && binding.policy_snapshot_known));
      assert.ok(policySnapshotBindingLedger.policy_snapshot_binding_catalog.approval_policy_bindings.every((binding) => binding.binding_status === "bound" && binding.policy_snapshot_known));
      assert.ok(policySnapshotBindingLedger.policy_snapshot_binding_catalog.output_policy_bindings.every((binding) => binding.binding_status === "bound" && binding.policy_snapshot_known));
      assert.ok(policySnapshotBindingLedger.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "policy-snapshot-bindings", "summary.md"), "utf8"), /Policy Snapshot Binding Ledger/);

      const errorCostObservabilityContractFreeze = await runErrorCostObservabilityContractFreeze({
        observabilityCatalogPath: path.join(outDir, "observability", "observability-catalog.json"),
        costBudgetLedgerPath: path.join(outDir, "cost-budget", "cost-budget-ledger.json"),
        tokenUsageLedgerPath: path.join(outDir, "token-usage", "token-usage-ledger.json"),
        costAttributionLedgerPath: path.join(outDir, "cost-attribution", "cost-attribution-ledger.json"),
        budgetAlertLedgerPath: path.join(outDir, "budget-alerts", "budget-alert-ledger.json"),
        eventAuditRunContractFreezePath: path.join(outDir, "event-audit-run-contract-freeze", "event-audit-run-contract-freeze.json"),
        outDir: path.join(outDir, "error-cost-observability-contract-freeze"),
        runAt: "2026-05-23T06:35:07.800Z",
      });
      const errorCostObservabilityContractFreezeSchema = JSON.parse(await readFile("schemas/error-cost-observability-contract-freeze.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(errorCostObservabilityContractFreeze, errorCostObservabilityContractFreezeSchema, {}, "error_cost_observability_contract_freeze"),
        [],
      );
      assert.equal(errorCostObservabilityContractFreeze.summary.freeze_status, "complete");
      assert.ok(errorCostObservabilityContractFreeze.summary.error_record_count >= observabilityCatalog.summary.blocked_run_count);
      assert.equal(errorCostObservabilityContractFreeze.summary.run_blocked_error_count, eventAuditRunContractFreeze.summary.run_ledger_count);
      assert.equal(errorCostObservabilityContractFreeze.summary.gate_failed_error_count, observabilityCatalog.summary.gate_failed_count);
      assert.equal(errorCostObservabilityContractFreeze.summary.cost_observation_count, costAttributionLedger.summary.attribution_record_count);
      assert.equal(errorCostObservabilityContractFreeze.summary.trace_projection_count, eventAuditRunContractFreeze.summary.run_ledger_count);
      assert.equal(errorCostObservabilityContractFreeze.summary.token_usage_linked_count, costAttributionLedger.summary.attribution_record_count);
      assert.equal(errorCostObservabilityContractFreeze.summary.missing_token_usage_count, 0);
      assert.equal(errorCostObservabilityContractFreeze.summary.trace_with_cost_count, errorCostObservabilityContractFreeze.summary.trace_projection_count);
      assert.equal(errorCostObservabilityContractFreeze.summary.trace_with_policy_snapshot_count, errorCostObservabilityContractFreeze.summary.trace_projection_count);
      assert.equal(errorCostObservabilityContractFreeze.summary.latency_observed_count, errorCostObservabilityContractFreeze.summary.trace_projection_count);
      assert.equal(errorCostObservabilityContractFreeze.summary.missing_latency_count, 0);
      assert.equal(errorCostObservabilityContractFreeze.summary.total_projected_usd, costAttributionLedger.summary.total_projected_usd);
      assert.equal(errorCostObservabilityContractFreeze.summary.total_token_count, costAttributionLedger.summary.total_token_count);
      assert.equal(errorCostObservabilityContractFreeze.summary.validation_error_count, 0);
      assert.equal(errorCostObservabilityContractFreeze.error_cost_observability_contract.error_records[0].schema_version, "error-record.v2");
      assert.equal(errorCostObservabilityContractFreeze.error_cost_observability_contract.cost_observations[0].schema_version, "cost-observation.v2");
      assert.equal(errorCostObservabilityContractFreeze.error_cost_observability_contract.trace_projections[0].schema_version, "trace-projection.v2");
      assert.ok(errorCostObservabilityContractFreeze.error_cost_observability_contract.error_records.every((record) => record.retry_status && record.correlation_id && record.policy_snapshot_id));
      assert.ok(errorCostObservabilityContractFreeze.error_cost_observability_contract.cost_observations.every((record) => record.token_usage_id && record.attribution_id && record.cost_hash));
      assert.ok(errorCostObservabilityContractFreeze.error_cost_observability_contract.trace_projections.every((trace) => trace.latency_status === "observed" && trace.retry_status && trace.policy_snapshot_id));
      assert.ok(errorCostObservabilityContractFreeze.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "error-cost-observability-contract-freeze", "summary.md"), "utf8"), /Error\/Cost\/Observability Contract Freeze/);

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

      const humanReviewV1RegressionFreeze = await runHumanReviewV1RegressionFreeze({
        reconciliationPath: path.join(outDir, "human-review-cycle-receipt-completion-reconciliation", "human-review-cycle-receipt-completion-reconciliation.json"),
        baselinePath: path.join(outDir, "human-review-cycle-receipt-completion-baseline", "human-review-cycle-receipt-completion-baseline.json"),
        manualCommandReceiptPackPath: path.join(outDir, "human-review-cycle-receipt-completion-manual-command-receipt-pack", "human-review-cycle-receipt-completion-manual-command-receipt-pack.json"),
        heldCommandResolutionPath: path.join(outDir, "human-review-cycle-receipt-completion-held-command-resolution", "human-review-cycle-receipt-completion-held-command-resolution.json"),
        protectedApprovalRequestPackPath: path.join(outDir, "human-review-cycle-receipt-completion-protected-approval-request-pack", "human-review-cycle-receipt-completion-protected-approval-request-pack.json"),
        manualRevalidationPath: path.join(outDir, "human-review-cycle-receipt-completion-manual-revalidation", "human-review-cycle-receipt-completion-manual-revalidation.json"),
        commandQueuePatchProjectionPath: path.join(outDir, "human-review-cycle-receipt-completion-command-queue-patch-projection", "human-review-cycle-receipt-completion-command-queue-patch-projection.json"),
        closeoutLedgerPath: path.join(outDir, "human-review-cycle-receipt-completion-closeout-ledger", "human-review-cycle-receipt-completion-closeout-ledger.json"),
        controlPlaneLoopPath: path.join(outDir, "control-plane-loop", "control-plane-loop.json"),
        dashboardPath: false,
        packagePath: "package.json",
        roadmapPath: "docs/implementation-roadmap.md",
        outDir: path.join(outDir, "human-review-v1-regression-freeze"),
        runAt: "2026-05-23T06:35:07.980Z",
      });
      const humanReviewV1RegressionFreezeSchema = JSON.parse(await readFile("schemas/human-review-v1-regression-freeze.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(humanReviewV1RegressionFreeze, humanReviewV1RegressionFreezeSchema, {}, "human_review_v1_regression_freeze"),
        [],
      );
      assert.equal(humanReviewV1RegressionFreeze.freeze_status, "frozen_with_pending_human_actions");
      assert.equal(humanReviewV1RegressionFreeze.safe_handling.regression_freeze_only, true);
      assert.equal(humanReviewV1RegressionFreeze.safe_handling.commands_executed, false);
      assert.equal(humanReviewV1RegressionFreeze.safe_handling.protected_actions_executed, false);
      assert.equal(humanReviewV1RegressionFreeze.summary.regression_fixture_artifact_count, 8);
      assert.equal(humanReviewV1RegressionFreeze.summary.regression_fixture_hash_count, humanReviewV1RegressionFreeze.summary.regression_fixture_artifact_count);
      assert.equal(humanReviewV1RegressionFreeze.summary.failed_verification_checkpoint_count, 0);
      assert.equal(humanReviewV1RegressionFreeze.summary.validation_error_count, 0);
      assert.equal(humanReviewV1RegressionFreeze.summary.loop_status, "passed");
      assert.equal(humanReviewV1RegressionFreeze.summary.loop_failed_step_count, 0);
      assert.equal(humanReviewV1RegressionFreeze.summary.loop_missing_artifact_count, 0);
      assert.equal(humanReviewV1RegressionFreeze.summary.closeout_item_count, humanReviewCycleReceiptCompletionCloseoutLedger.summary.closeout_item_count);
      assert.equal(humanReviewV1RegressionFreeze.summary.closeout_pending_count, humanReviewCycleReceiptCompletionCloseoutLedger.summary.pending_count);
      assert.equal(humanReviewV1RegressionFreeze.summary.closeout_unknown_status_count, 0);
      assert.equal(humanReviewV1RegressionFreeze.summary.command_executed_count, 0);
      assert.equal(humanReviewV1RegressionFreeze.summary.patch_applied_count, 0);
      assert.equal(humanReviewV1RegressionFreeze.summary.audit_event_emitted_count, 0);
      assert.equal(humanReviewV1RegressionFreeze.summary.protected_action_executed_count, 0);
      assert.ok(humanReviewV1RegressionFreeze.regression_fixture.artifact_refs.every((artifactRef) => artifactRef.content_hash?.startsWith("sha256:")));
      assert.match(await readFile(path.join(outDir, "human-review-v1-regression-freeze", "summary.md"), "utf8"), /Human Review v1 Regression Freeze/);

      const contractInventory = await runContractInventory({
        outDir: path.join(outDir, "contract-inventory"),
        runAt: "2026-05-23T06:35:07.990Z",
      });
      const contractInventorySchema = JSON.parse(await readFile("schemas/contract-inventory.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(contractInventory, contractInventorySchema, {}, "contract_inventory"),
        [],
      );
      assert.equal(contractInventory.summary.inventory_status, "complete");
      assert.ok(contractInventory.summary.schema_count >= 80);
      assert.equal(contractInventory.summary.schema_parse_error_count, 0);
      assert.ok(contractInventory.summary.package_script_count >= 100);
      assert.ok(contractInventory.summary.loop_output_contract_count >= 60);
      assert.ok(contractInventory.summary.dashboard_source_count >= 80);
      assert.ok(contractInventory.summary.api_route_count >= 200);
      assert.ok(contractInventory.summary.artifact_contract_count >= contractInventory.summary.dashboard_source_count);
      assert.equal(contractInventory.summary.owner_mapped_item_count, contractInventory.summary.inventory_item_count);
      assert.equal(contractInventory.summary.validation_error_count, 0);
      assert.ok(contractInventory.schemas.some((schema) => schema.schema_id === "contract-inventory"));
      assert.ok(contractInventory.dashboard_sources.some((source) => source.source_id === "contract_inventory"));
      assert.ok(contractInventory.api_routes.some((route) => route.path === "/api/contract-inventories"));
      assert.ok(contractInventory.owner_map.every((entry) => entry.owner_area && entry.plane && entry.stability_tier));
      assert.match(await readFile(path.join(outDir, "contract-inventory", "summary.md"), "utf8"), /Contract Inventory/);

      const contractDependencyMap = await runContractDependencyMap({
        inventoryPath: path.join(outDir, "contract-inventory", "contract-inventory.json"),
        outDir: path.join(outDir, "contract-dependency-map"),
        runAt: "2026-05-23T06:35:07.995Z",
      });
      const contractDependencyMapSchema = JSON.parse(await readFile("schemas/contract-dependency-map.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(contractDependencyMap, contractDependencyMapSchema, {}, "contract_dependency_map"),
        [],
      );
      assert.equal(contractDependencyMap.summary.map_status, "complete");
      assert.equal(contractDependencyMap.summary.source_inventory_id, contractInventory.inventory_id);
      assert.equal(contractDependencyMap.summary.source_inventory_status, "complete");
      assert.equal(contractDependencyMap.summary.node_count, contractInventory.summary.inventory_item_count);
      assert.ok(contractDependencyMap.summary.edge_count >= contractInventory.summary.dashboard_source_count);
      assert.ok(contractDependencyMap.summary.schema_dependency_edge_count >= contractInventory.summary.artifact_contract_with_schema_count);
      assert.ok(contractDependencyMap.summary.dashboard_dependency_edge_count >= contractInventory.summary.dashboard_source_with_schema_count);
      assert.ok(contractDependencyMap.summary.api_dependency_edge_count >= 1);
      assert.ok(contractDependencyMap.summary.owner_dependency_count >= 1);
      assert.equal(contractDependencyMap.summary.direction_violation_count, 0);
      assert.equal(contractDependencyMap.summary.validation_error_count, 0);
      assert.ok(contractDependencyMap.nodes.some((node) => node.inventory_item_id === "dashboard_source.contract_inventory"));
      assert.ok(contractDependencyMap.edges.some((edge) => edge.edge_type === "artifact_contract_to_dashboard_source"));
      assert.ok(contractDependencyMap.edges.some((edge) => edge.edge_type === "dashboard_source_to_api_route"));
      assert.ok(contractDependencyMap.breaking_change_risks.some((risk) => risk.risk_type === "api_route_without_source_edge"));
      assert.match(await readFile(path.join(outDir, "contract-dependency-map", "summary.md"), "utf8"), /Contract Dependency Map/);

      const schemaVersioningRules = await runSchemaVersioningRules({
        contractInventoryPath: path.join(outDir, "contract-inventory", "contract-inventory.json"),
        outDir: path.join(outDir, "schema-versioning-rules"),
        runAt: "2026-05-23T06:35:07.997Z",
      });
      const schemaVersioningRulesSchema = JSON.parse(await readFile("schemas/schema-versioning-rules.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(schemaVersioningRules, schemaVersioningRulesSchema, {}, "schema_versioning_rules"),
        [],
      );
      assert.equal(schemaVersioningRules.summary.guideline_status, "complete");
      assert.equal(schemaVersioningRules.summary.source_inventory_id, contractInventory.inventory_id);
      assert.equal(schemaVersioningRules.summary.source_inventory_status, "complete");
      assert.equal(schemaVersioningRules.summary.schema_count, contractInventory.summary.schema_count);
      assert.equal(schemaVersioningRules.summary.versioned_schema_count + schemaVersioningRules.summary.legacy_exception_count, schemaVersioningRules.summary.schema_count);
      assert.equal(schemaVersioningRules.summary.legacy_exception_count, 2);
      assert.equal(schemaVersioningRules.summary.non_compliant_schema_count, 0);
      assert.equal(schemaVersioningRules.summary.closed_world_schema_count, 0);
      assert.equal(schemaVersioningRules.summary.migration_manifest_rule_count, 1);
      assert.equal(schemaVersioningRules.summary.validation_error_count, 0);
      assert.ok(schemaVersioningRules.rulebook.required_rules.some((rule) => rule.rule_id === "optional_addition_default"));
      assert.ok(schemaVersioningRules.rulebook.required_rules.some((rule) => rule.rule_id === "migration_manifest_required"));
      assert.ok(schemaVersioningRules.schema_versions.every((record) => record.version_status !== "non_compliant"));
      assert.ok(schemaVersioningRules.legacy_exceptions.some((exception) => exception.schema_id === "matter"));
      assert.ok(schemaVersioningRules.legacy_exceptions.some((exception) => exception.schema_id === "dev-projects"));
      assert.ok(schemaVersioningRules.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "schema-versioning-rules", "summary.md"), "utf8"), /Schema Versioning Rules/);

      const schemaMigrationManifest = await runSchemaMigrationManifest({
        schemaVersioningRulesPath: path.join(outDir, "schema-versioning-rules", "schema-versioning-rules.json"),
        contractInventoryPath: path.join(outDir, "contract-inventory", "contract-inventory.json"),
        outDir: path.join(outDir, "schema-migration-manifest"),
        runAt: "2026-05-23T06:35:07.998Z",
      });
      const schemaMigrationManifestSchema = JSON.parse(await readFile("schemas/schema-migration-manifest.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(schemaMigrationManifest, schemaMigrationManifestSchema, {}, "schema_migration_manifest"),
        [],
      );
      assert.equal(schemaMigrationManifest.summary.migration_manifest_status, "complete");
      assert.equal(schemaMigrationManifest.summary.source_guideline_status, "complete");
      assert.equal(schemaMigrationManifest.summary.manifest_count, 3);
      assert.equal(schemaMigrationManifest.summary.core_migration_count, 1);
      assert.equal(schemaMigrationManifest.summary.pack_migration_count, 1);
      assert.equal(schemaMigrationManifest.summary.index_migration_count, 1);
      assert.equal(schemaMigrationManifest.summary.migration_record_count, schemaMigrationManifest.summary.manifest_count);
      assert.equal(schemaMigrationManifest.summary.declared_manifest_count, schemaMigrationManifest.summary.manifest_count);
      assert.equal(schemaMigrationManifest.summary.planned_record_count, schemaMigrationManifest.summary.manifest_count);
      assert.equal(schemaMigrationManifest.summary.not_run_dry_run_record_count, schemaMigrationManifest.summary.manifest_count);
      assert.ok(schemaMigrationManifest.summary.data_migration_step_count >= 3);
      assert.ok(schemaMigrationManifest.summary.index_migration_step_count >= 3);
      assert.equal(schemaMigrationManifest.summary.dry_run_command_count, schemaMigrationManifest.summary.manifest_count);
      assert.equal(schemaMigrationManifest.summary.rollback_note_count, schemaMigrationManifest.summary.manifest_count);
      assert.equal(schemaMigrationManifest.summary.validation_command_count, schemaMigrationManifest.summary.manifest_count);
      assert.equal(schemaMigrationManifest.summary.legacy_exception_covered_count, schemaVersioningRules.summary.legacy_exception_count);
      assert.equal(schemaMigrationManifest.summary.missing_legacy_exception_count, 0);
      assert.equal(schemaMigrationManifest.summary.validation_error_count, 0);
      assert.deepEqual(Object.keys(schemaMigrationManifest.summary.by_scope).sort(), ["core", "index", "pack"]);
      assert.ok(schemaMigrationManifest.migration_manifests.every((manifest) => manifest.schema_version === "schema-migration-manifest.v1"));
      assert.ok(schemaMigrationManifest.migration_manifests.every((manifest) => manifest.data_migration_steps.length > 0));
      assert.ok(schemaMigrationManifest.migration_manifests.every((manifest) => manifest.index_migration_steps.length > 0));
      assert.ok(schemaMigrationManifest.migration_records.every((record) => record.dry_run_status === "not_run"));
      assert.ok(schemaMigrationManifest.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "schema-migration-manifest", "summary.md"), "utf8"), /Schema Migration Manifest/);

      const policyGoldenFixtures = await runPolicyGoldenFixtures({
        matterAccessPolicyEvaluatorPath: path.join(outDir, "matter-access-policy", "matter-access-policy-evaluator.json"),
        modelPolicyEnforcementPath: path.join(outDir, "model-policy-enforcement", "model-policy-enforcement.json"),
        toolRuntimePolicyEnforcementPath: path.join(outDir, "tool-runtime-policy", "tool-runtime-policy-enforcement.json"),
        outputDestinationPolicyEnforcementPath: path.join(outDir, "output-destination-policy", "output-destination-policy-enforcement.json"),
        storePolicyAdapterPath: path.join(outDir, "store-policy", "store-policy-adapter.json"),
        personalWorkspaceBoundaryPath: path.join(outDir, "personal-workspace-boundary", "personal-workspace-boundary.json"),
        outDir: path.join(outDir, "policy-golden-fixtures"),
        runAt: "2026-05-23T06:35:07.875Z",
      });
      const policyGoldenFixturesSchema = JSON.parse(await readFile("schemas/policy-golden-fixtures.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(policyGoldenFixtures, policyGoldenFixturesSchema, {}, "policy_golden_fixtures"),
        [],
      );
      assert.equal(policyGoldenFixtures.summary.policy_golden_fixture_status, "complete");
      assert.equal(policyGoldenFixtures.summary.fixture_group_count, 6);
      assert.ok(policyGoldenFixtures.summary.policy_fixture_case_count >= 15);
      assert.ok(policyGoldenFixtures.summary.allow_case_count > 0);
      assert.ok(policyGoldenFixtures.summary.review_case_count > 0);
      assert.ok(policyGoldenFixtures.summary.deny_case_count > 0);
      assert.equal(policyGoldenFixtures.summary.locked_case_count, policyGoldenFixtures.summary.policy_fixture_case_count);
      assert.equal(policyGoldenFixtures.summary.mismatch_case_count, 0);
      assert.equal(policyGoldenFixtures.summary.missing_case_count, 0);
      assert.equal(policyGoldenFixtures.summary.locked_regression_hash_count, policyGoldenFixtures.summary.policy_fixture_case_count);
      assert.equal(policyGoldenFixtures.summary.review_case_with_human_gate_count, policyGoldenFixtures.summary.review_case_count);
      assert.equal(policyGoldenFixtures.summary.deny_case_blocked_count, policyGoldenFixtures.summary.deny_case_count);
      assert.equal(policyGoldenFixtures.summary.validation_error_count, 0);
      assert.ok(policyGoldenFixtures.policy_golden_fixture_catalog.policy_fixture_cases.some((policyCase) => policyCase.fixture_group === "matter_access" && policyCase.expected_decision === "allow"));
      assert.ok(policyGoldenFixtures.policy_golden_fixture_catalog.policy_fixture_cases.some((policyCase) => policyCase.fixture_group === "model_policy" && policyCase.expected_decision === "deny"));
      assert.ok(policyGoldenFixtures.policy_golden_fixture_catalog.policy_fixture_cases.some((policyCase) => policyCase.fixture_group === "tool_runtime" && policyCase.expected_decision === "review"));
      assert.ok(policyGoldenFixtures.policy_golden_fixture_catalog.policy_fixture_cases.some((policyCase) => policyCase.fixture_group === "store_policy" && policyCase.expected_decision === "review"));
      assert.ok(policyGoldenFixtures.policy_golden_fixture_catalog.policy_fixture_cases.some((policyCase) => policyCase.fixture_group === "workspace_boundary" && policyCase.observed_gate_status === "blocked"));
      assert.ok(policyGoldenFixtures.policy_golden_fixture_catalog.policy_fixture_cases.every((policyCase) => policyCase.regression_hash?.startsWith("sha256:")));
      assert.ok(policyGoldenFixtures.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "policy-golden-fixtures", "summary.md"), "utf8"), /Policy Golden Fixtures/);

      const policyOperationsSurface = await runPolicyOperationsSurface({
        matterAccessPolicyEvaluatorPath: path.join(outDir, "matter-access-policy", "matter-access-policy-evaluator.json"),
        dataClassificationRuleEnginePath: path.join(outDir, "data-classification-rules", "data-classification-rule-engine.json"),
        modelPolicyEnforcementPath: path.join(outDir, "model-policy-enforcement", "model-policy-enforcement.json"),
        toolRuntimePolicyEnforcementPath: path.join(outDir, "tool-runtime-policy", "tool-runtime-policy-enforcement.json"),
        outputDestinationPolicyEnforcementPath: path.join(outDir, "output-destination-policy", "output-destination-policy-enforcement.json"),
        approvalAuthorityLedgerPath: path.join(outDir, "approval-authority", "approval-authority-ledger.json"),
        matterTaggingDecisionLedgerPath: path.join(outDir, "matter-tagging", "matter-tagging-ledger.json"),
        conflictCheckInterfacePath: path.join(outDir, "conflict-check", "conflict-check-interface.json"),
        storePolicyAdapterPath: path.join(outDir, "store-policy", "store-policy-adapter.json"),
        personalWorkspaceBoundaryPath: path.join(outDir, "personal-workspace-boundary", "personal-workspace-boundary.json"),
        policyGoldenFixturesPath: path.join(outDir, "policy-golden-fixtures", "policy-golden-fixtures.json"),
        outDir: path.join(outDir, "policy-operations-surface"),
        runAt: "2026-05-23T06:35:07.878Z",
      });
      const policyOperationsSurfaceSchema = JSON.parse(await readFile("schemas/policy-operations-surface.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(policyOperationsSurface, policyOperationsSurfaceSchema, {}, "policy_operations_surface"),
        [],
      );
      assert.equal(policyOperationsSurface.summary.policy_operations_surface_status, "complete");
      assert.ok(policyOperationsSurface.summary.policy_decision_row_count > 0);
      assert.ok(policyOperationsSurface.summary.allow_decision_count > 0);
      assert.ok(policyOperationsSurface.summary.review_decision_count > 0);
      assert.ok(policyOperationsSurface.summary.deny_decision_count > 0);
      assert.ok(policyOperationsSurface.summary.policy_violation_row_count > 0);
      assert.ok(policyOperationsSurface.summary.policy_pending_approval_row_count > 0);
      assert.ok(policyOperationsSurface.summary.human_gate_pending_approval_count > 0);
      assert.equal(policyOperationsSurface.summary.validation_error_count, 0);
      assert.ok(policyOperationsSurface.policy_operations_catalog.policy_decision_rows.some((row) => row.decision === "deny"));
      assert.ok(policyOperationsSurface.policy_operations_catalog.policy_violation_rows.some((row) => row.severity === "critical"));
      assert.ok(policyOperationsSurface.policy_operations_catalog.policy_pending_approval_rows.some((row) => row.status === "pending"));
      assert.ok(policyOperationsSurface.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "policy-operations-surface", "summary.md"), "utf8"), /Policy Operations Surface/);

      const matterBoundarySlice = await runMatterBoundarySlice({
        resourceIngestPath: path.join(outDir, "ingest", "resource-ingest.json"),
        resourceContractFreezePath: path.join(outDir, "resource-contract-freeze", "resource-contract-freeze.json"),
        matterAccessPolicyEvaluatorPath: path.join(outDir, "matter-access-policy", "matter-access-policy-evaluator.json"),
        accessAuditProjectionPath: path.join(outDir, "access-audit", "access-audit-projection.json"),
        storePolicyAdapterPath: path.join(outDir, "store-policy", "store-policy-adapter.json"),
        policyOperationsSurfacePath: path.join(outDir, "policy-operations-surface", "policy-operations-surface.json"),
        outDir: path.join(outDir, "matter-boundary-slice"),
        runAt: "2026-05-23T06:35:07.879Z",
      });
      const matterBoundarySliceSchema = JSON.parse(await readFile("schemas/matter-boundary-slice.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(matterBoundarySlice, matterBoundarySliceSchema, {}, "matter_boundary_slice"),
        [],
      );
      assert.equal(matterBoundarySlice.summary.matter_boundary_slice_status, "complete");
      assert.equal(matterBoundarySlice.summary.resource_boundary_path_count, resourceContractFreeze.summary.resource_count);
      assert.equal(matterBoundarySlice.summary.promoted_resource_path_count, matterBoundarySlice.summary.resource_boundary_path_count);
      assert.equal(matterBoundarySlice.summary.access_decision_covered_resource_count, matterBoundarySlice.summary.resource_boundary_path_count);
      assert.equal(matterBoundarySlice.summary.access_audited_resource_count, matterBoundarySlice.summary.resource_boundary_path_count);
      assert.equal(matterBoundarySlice.summary.store_compiled_resource_count, matterBoundarySlice.summary.resource_boundary_path_count);
      assert.equal(matterBoundarySlice.summary.required_store_filter_resource_count, matterBoundarySlice.summary.resource_boundary_path_count);
      assert.equal(matterBoundarySlice.summary.negative_probe_blocked_resource_count, matterBoundarySlice.summary.resource_boundary_path_count);
      assert.equal(matterBoundarySlice.summary.policy_surface_visible_resource_count, matterBoundarySlice.summary.resource_boundary_path_count);
      assert.ok(matterBoundarySlice.summary.retrieval_gate_check_count > 0);
      assert.equal(matterBoundarySlice.summary.passed_retrieval_gate_check_count, matterBoundarySlice.summary.retrieval_gate_check_count);
      assert.equal(matterBoundarySlice.summary.failed_retrieval_gate_check_count, 0);
      assert.equal(matterBoundarySlice.summary.negative_probe_blocked_count, matterBoundarySlice.summary.negative_probe_expected_count);
      assert.equal(matterBoundarySlice.summary.unassigned_executable_query_plan_count, 0);
      assert.ok(matterBoundarySlice.summary.held_for_matter_tagging_resource_count > 0);
      assert.equal(matterBoundarySlice.summary.validation_error_count, 0);
      assert.ok(matterBoundarySlice.boundary_catalog.resource_boundary_paths.every((row) => row.boundary_status === "held_for_matter_tagging"));
      assert.ok(matterBoundarySlice.boundary_catalog.retrieval_gate_checks.every((row) => row.retrieval_gate_status === "passed"));
      assert.ok(matterBoundarySlice.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "matter-boundary-slice", "summary.md"), "utf8"), /Matter Boundary Slice/);

      const identityPolicyMatterFreeze = await runIdentityPolicyMatterFreeze({
        identityModelPath: path.join(outDir, "identity-model", "identity-model.json"),
        clientCounterpartyRegistryPath: path.join(outDir, "client-counterparty-registry", "client-counterparty-registry.json"),
        matterProfileTeamLedgerPath: path.join(outDir, "matter-profile-team-ledger", "matter-profile-team-ledger.json"),
        wallPolicyContractPath: path.join(outDir, "wall-policy-contract", "wall-policy-contract.json"),
        matterAccessPolicyEvaluatorPath: path.join(outDir, "matter-access-policy", "matter-access-policy-evaluator.json"),
        dataClassificationRuleEnginePath: path.join(outDir, "data-classification-rules", "data-classification-rule-engine.json"),
        modelPolicyEnforcementPath: path.join(outDir, "model-policy-enforcement", "model-policy-enforcement.json"),
        toolRuntimePolicyEnforcementPath: path.join(outDir, "tool-runtime-policy", "tool-runtime-policy-enforcement.json"),
        outputDestinationPolicyEnforcementPath: path.join(outDir, "output-destination-policy", "output-destination-policy-enforcement.json"),
        approvalAuthorityLedgerPath: path.join(outDir, "approval-authority", "approval-authority-ledger.json"),
        policySnapshotBindingLedgerPath: path.join(outDir, "policy-snapshot-bindings", "policy-snapshot-binding-ledger.json"),
        matterTaggingDecisionLedgerPath: path.join(outDir, "matter-tagging", "matter-tagging-ledger.json"),
        accessAuditProjectionPath: path.join(outDir, "access-audit", "access-audit-projection.json"),
        storePolicyAdapterPath: path.join(outDir, "store-policy", "store-policy-adapter.json"),
        conflictCheckInterfacePath: path.join(outDir, "conflict-check", "conflict-check-interface.json"),
        personalWorkspaceBoundaryPath: path.join(outDir, "personal-workspace-boundary", "personal-workspace-boundary.json"),
        policyGoldenFixturesPath: path.join(outDir, "policy-golden-fixtures", "policy-golden-fixtures.json"),
        policyOperationsSurfacePath: path.join(outDir, "policy-operations-surface", "policy-operations-surface.json"),
        matterBoundarySlicePath: path.join(outDir, "matter-boundary-slice", "matter-boundary-slice.json"),
        outDir: path.join(outDir, "identity-policy-matter-freeze"),
        runAt: "2026-05-23T06:35:07.890Z",
      });
      const identityPolicyMatterFreezeSchema = JSON.parse(await readFile("schemas/identity-policy-matter-freeze.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(identityPolicyMatterFreeze, identityPolicyMatterFreezeSchema, {}, "identity_policy_matter_freeze"),
        [],
      );
      assert.equal(identityPolicyMatterFreeze.freeze_status, "frozen_with_pending_human_actions");
      assert.equal(identityPolicyMatterFreeze.summary.required_source_count, 19);
      assert.equal(identityPolicyMatterFreeze.summary.available_required_source_count, 19);
      assert.equal(identityPolicyMatterFreeze.summary.clean_source_count, 19);
      assert.equal(identityPolicyMatterFreeze.summary.failed_freeze_checkpoint_count, 0);
      assert.equal(identityPolicyMatterFreeze.summary.passed_freeze_checkpoint_count, identityPolicyMatterFreeze.summary.freeze_checkpoint_count);
      assert.equal(identityPolicyMatterFreeze.summary.policy_fixture_case_count, policyGoldenFixtures.summary.policy_fixture_case_count);
      assert.equal(identityPolicyMatterFreeze.summary.locked_policy_fixture_count, policyGoldenFixtures.summary.locked_case_count);
      assert.equal(identityPolicyMatterFreeze.summary.policy_decision_row_count, policyOperationsSurface.summary.policy_decision_row_count);
      assert.equal(identityPolicyMatterFreeze.summary.resource_boundary_path_count, matterBoundarySlice.summary.resource_boundary_path_count);
      assert.equal(identityPolicyMatterFreeze.summary.retrieval_gate_check_count, matterBoundarySlice.summary.retrieval_gate_check_count);
      assert.equal(identityPolicyMatterFreeze.summary.unassigned_executable_query_plan_count, 0);
      assert.equal(identityPolicyMatterFreeze.summary.protected_action_executed_count, 0);
      assert.equal(identityPolicyMatterFreeze.summary.validation_error_count, 0);
      assert.ok(identityPolicyMatterFreeze.freeze_source_statuses.every((source) => source.source_status === "passed"));
      assert.ok(identityPolicyMatterFreeze.freeze_checkpoints.every((checkpoint) => checkpoint.status === "passed"));
      assert.match(await readFile(path.join(outDir, "identity-policy-matter-freeze", "summary.md"), "utf8"), /Identity\/Policy\/Matter Freeze/);

      const resourceStoreInterface = await runResourceStoreInterface({
        resourceIngestPath: path.join(outDir, "ingest", "resource-ingest.json"),
        resourceContractFreezePath: path.join(outDir, "resource-contract-freeze", "resource-contract-freeze.json"),
        storePolicyAdapterPath: path.join(outDir, "store-policy", "store-policy-adapter.json"),
        identityPolicyMatterFreezePath: path.join(outDir, "identity-policy-matter-freeze", "identity-policy-matter-freeze.json"),
        outDir: path.join(outDir, "resource-store-interface"),
        runAt: "2026-05-23T06:35:07.900Z",
      });
      const resourceStoreInterfaceSchema = JSON.parse(await readFile("schemas/resource-store-interface.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(resourceStoreInterface, resourceStoreInterfaceSchema, {}, "resource_store_interface"),
        [],
      );
      assert.equal(resourceStoreInterface.summary.resource_store_interface_status, "complete");
      assert.equal(resourceStoreInterface.summary.resource_store_record_count, resourceContractFreeze.summary.resource_count);
      assert.equal(resourceStoreInterface.summary.resource_version_store_record_count, resourceContractFreeze.summary.resource_version_count);
      assert.equal(resourceStoreInterface.summary.registry_adapter_binding_count, 1);
      assert.equal(resourceStoreInterface.summary.ingestion_adapter_binding_count, 1);
      assert.equal(resourceStoreInterface.summary.dashboard_adapter_binding_count, 1);
      assert.equal(resourceStoreInterface.summary.bound_required_consumer_layer_count, resourceStoreInterface.summary.required_consumer_layer_count);
      assert.equal(resourceStoreInterface.summary.required_resource_filter_count, 4);
      assert.ok(resourceStoreInterface.summary.resource_store_rls_template_count > 0);
      assert.ok(resourceStoreInterface.summary.compiled_resource_query_plan_count > 0);
      assert.equal(resourceStoreInterface.summary.executable_resource_query_plan_count, 0);
      assert.equal(resourceStoreInterface.summary.validation_error_count, 0);
      assert.ok(resourceStoreInterface.resource_store_catalog.resource_store_records.every((record) => record.collection_id === "resource_store"));
      assert.ok(resourceStoreInterface.adapter_bindings.some((binding) => binding.consumer_layer === "registry"));
      assert.ok(resourceStoreInterface.adapter_bindings.some((binding) => binding.consumer_layer === "ingestion"));
      assert.ok(resourceStoreInterface.adapter_bindings.some((binding) => binding.consumer_layer === "dashboard"));
      assert.ok(resourceStoreInterface.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "resource-store-interface", "summary.md"), "utf8"), /Resource Store Interface/);

      const immutableObjectStoreLayout = await runImmutableObjectStoreLayout({
        resourceStoreInterfacePath: path.join(outDir, "resource-store-interface", "resource-store-interface.json"),
        outputArtifactCatalogPath: path.join(outDir, "output-catalog", "output-catalog.json"),
        outputDeliveryContractFreezePath: path.join(outDir, "output-delivery-contract-freeze", "output-delivery-contract-freeze.json"),
        outDir: path.join(outDir, "immutable-object-store-layout"),
        runAt: "2026-05-23T06:35:07.925Z",
      });
      const immutableObjectStoreLayoutSchema = JSON.parse(await readFile("schemas/immutable-object-store-layout.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(immutableObjectStoreLayout, immutableObjectStoreLayoutSchema, {}, "immutable_object_store_layout"),
        [],
      );
      assert.equal(immutableObjectStoreLayout.summary.object_store_layout_status, "complete");
      assert.equal(immutableObjectStoreLayout.summary.raw_source_object_path_count, resourceStoreInterface.summary.resource_version_store_record_count);
      assert.equal(immutableObjectStoreLayout.summary.generated_output_object_path_count, outputDeliveryContractFreeze.summary.output_artifact_count);
      assert.equal(immutableObjectStoreLayout.summary.path_resolver_count, 2);
      assert.equal(immutableObjectStoreLayout.summary.collision_count, 0);
      assert.equal(immutableObjectStoreLayout.summary.absolute_source_path_key_count, 0);
      assert.equal(immutableObjectStoreLayout.summary.content_addressed_path_count, immutableObjectStoreLayout.summary.total_object_path_count);
      assert.equal(immutableObjectStoreLayout.summary.validation_error_count, 0);
      assert.ok(immutableObjectStoreLayout.object_store_catalog.raw_source_object_paths.every((record) => record.namespace === "raw-source"));
      assert.ok(immutableObjectStoreLayout.object_store_catalog.generated_output_object_paths.every((record) => record.namespace === "generated-output"));
      assert.ok(immutableObjectStoreLayout.object_store_catalog.path_resolvers.every((resolver) => resolver.overwrite_policy === "forbidden"));
      assert.ok(immutableObjectStoreLayout.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "immutable-object-store-layout", "summary.md"), "utf8"), /Immutable Object Store Layout/);

      const resourceVersionLedger = await runResourceVersionLedger({
        resourceIngestPath: path.join(outDir, "ingest", "resource-ingest.json"),
        resourceStoreInterfacePath: path.join(outDir, "resource-store-interface", "resource-store-interface.json"),
        immutableObjectStoreLayoutPath: path.join(outDir, "immutable-object-store-layout", "immutable-object-store-layout.json"),
        outDir: path.join(outDir, "resource-version-ledger"),
        runAt: "2026-05-23T06:35:07.940Z",
      });
      const resourceVersionLedgerSchema = JSON.parse(await readFile("schemas/resource-version-ledger.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(resourceVersionLedger, resourceVersionLedgerSchema, {}, "resource_version_ledger"),
        [],
      );
      assert.equal(resourceVersionLedger.summary.resource_version_ledger_status, "complete");
      assert.equal(resourceVersionLedger.summary.resource_version_count, resourceStoreInterface.summary.resource_version_store_record_count);
      assert.equal(resourceVersionLedger.summary.version_family_count, resourceStoreInterface.summary.resource_store_record_count);
      assert.equal(resourceVersionLedger.summary.current_version_count, resourceStoreInterface.summary.resource_version_store_record_count);
      assert.equal(resourceVersionLedger.summary.duplicate_candidate_count, ingest.summary.duplicate_count);
      assert.equal(resourceVersionLedger.summary.object_path_binding_count, resourceStoreInterface.summary.resource_version_store_record_count);
      assert.equal(resourceVersionLedger.summary.bound_object_path_count, resourceVersionLedger.summary.object_path_binding_count);
      assert.equal(resourceVersionLedger.summary.unbound_object_path_count, 0);
      assert.equal(resourceVersionLedger.summary.validation_error_count, 0);
      assert.ok(resourceVersionLedger.version_ledger_catalog.version_families.every((family) => family.source_system && family.external_id));
      assert.ok(resourceVersionLedger.version_ledger_catalog.version_events.some((event) => event.event_type === "version_recorded"));
      assert.ok(resourceVersionLedger.version_ledger_catalog.object_path_bindings.every((binding) => binding.binding_status === "bound"));
      assert.ok(resourceVersionLedger.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "resource-version-ledger", "summary.md"), "utf8"), /Resource Version Ledger/);

      const normalizedTextContract = await runNormalizedTextContract({
        resourceIngestPath: path.join(outDir, "ingest", "resource-ingest.json"),
        resourceStoreInterfacePath: path.join(outDir, "resource-store-interface", "resource-store-interface.json"),
        immutableObjectStoreLayoutPath: path.join(outDir, "immutable-object-store-layout", "immutable-object-store-layout.json"),
        resourceVersionLedgerPath: path.join(outDir, "resource-version-ledger", "resource-version-ledger.json"),
        outDir: path.join(outDir, "normalized-text-contract"),
        runAt: "2026-05-23T06:35:07.955Z",
      });
      const normalizedTextContractSchema = JSON.parse(await readFile("schemas/normalized-text-contract.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(normalizedTextContract, normalizedTextContractSchema, {}, "normalized_text_contract"),
        [],
      );
      assert.equal(normalizedTextContract.summary.normalized_text_contract_status, "complete");
      assert.equal(normalizedTextContract.summary.normalized_text_artifact_count, ingest.resource_evidence.normalized_texts.length);
      assert.equal(normalizedTextContract.summary.location_map_count, normalizedTextContract.summary.normalized_text_artifact_count);
      assert.equal(normalizedTextContract.summary.source_span_seed_count, normalizedTextContract.summary.normalized_text_artifact_count);
      assert.equal(normalizedTextContract.summary.source_span_seed_ready_count, normalizedTextContract.summary.source_span_seed_count);
      assert.equal(normalizedTextContract.summary.resource_version_link_count, normalizedTextContract.summary.normalized_text_artifact_count);
      assert.equal(normalizedTextContract.summary.version_family_link_count, normalizedTextContract.summary.normalized_text_artifact_count);
      assert.equal(normalizedTextContract.summary.raw_source_bound_count, normalizedTextContract.summary.normalized_text_artifact_count);
      assert.equal(normalizedTextContract.summary.text_hash_count, normalizedTextContract.summary.normalized_text_artifact_count);
      assert.ok(normalizedTextContract.summary.page_unit_count >= normalizedTextContract.summary.normalized_text_artifact_count);
      assert.ok(normalizedTextContract.summary.paragraph_unit_count >= normalizedTextContract.summary.normalized_text_artifact_count);
      assert.ok(normalizedTextContract.summary.line_unit_count >= normalizedTextContract.summary.normalized_text_artifact_count);
      assert.equal(normalizedTextContract.summary.validation_error_count, 0);
      assert.ok(normalizedTextContract.normalized_text_catalog.normalized_text_artifacts.every((artifact) => artifact.offset_unit === "utf16_code_unit"));
      assert.ok(normalizedTextContract.normalized_text_catalog.location_maps.every((map) => map.page_units.length > 0 && map.paragraph_units.length > 0 && map.line_units.length > 0));
      assert.ok(normalizedTextContract.normalized_text_catalog.source_span_seeds.every((seed) => seed.seed_status === "ready"));
      assert.ok(normalizedTextContract.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "normalized-text-contract", "summary.md"), "utf8"), /Normalized Text Contract/);

      const extractorAdapterContract = await runExtractorAdapterContract({
        resourceIngestPath: path.join(outDir, "ingest", "resource-ingest.json"),
        normalizedTextContractPath: path.join(outDir, "normalized-text-contract", "normalized-text-contract.json"),
        outDir: path.join(outDir, "extractor-adapter-contract"),
        runAt: "2026-05-23T06:35:07.970Z",
      });
      const extractorAdapterContractSchema = JSON.parse(await readFile("schemas/extractor-adapter-contract.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(extractorAdapterContract, extractorAdapterContractSchema, {}, "extractor_adapter_contract"),
        [],
      );
      assert.equal(extractorAdapterContract.summary.extractor_adapter_contract_status, "complete");
      assert.ok(extractorAdapterContract.summary.extractor_adapter_count > 0);
      assert.equal(extractorAdapterContract.summary.extractor_io_contract_count, extractorAdapterContract.summary.extractor_adapter_count);
      assert.equal(extractorAdapterContract.summary.normalized_text_artifact_count, normalizedTextContract.summary.normalized_text_artifact_count);
      assert.equal(extractorAdapterContract.summary.normalized_text_binding_count, normalizedTextContract.summary.normalized_text_artifact_count);
      assert.equal(extractorAdapterContract.summary.bound_normalized_text_count, normalizedTextContract.summary.normalized_text_artifact_count);
      assert.equal(extractorAdapterContract.summary.unbound_normalized_text_count, 0);
      assert.equal(extractorAdapterContract.summary.local_only_adapter_count, extractorAdapterContract.summary.extractor_adapter_count);
      assert.equal(extractorAdapterContract.summary.external_service_adapter_count, 0);
      assert.equal(extractorAdapterContract.summary.ocr_policy_external_service_count, 0);
      assert.equal(extractorAdapterContract.summary.pdf_ocr_local_manual_policy_count, 1);
      assert.equal(extractorAdapterContract.summary.validation_error_count, 0);
      assert.ok(extractorAdapterContract.extractor_adapter_catalog.extractor_adapters.every((adapter) => adapter.execution_boundary === "local_deterministic" && adapter.external_service_allowed === false));
      assert.ok(extractorAdapterContract.extractor_adapter_catalog.normalized_text_bindings.every((binding) => binding.binding_status === "bound"));
      assert.ok(extractorAdapterContract.extractor_adapter_catalog.normalized_text_bindings.every((binding) => binding.required_identity_fields_preserved && binding.lineage_fields_preserved));
      assert.ok(extractorAdapterContract.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "extractor-adapter-contract", "summary.md"), "utf8"), /Extractor Adapter Contract/);

      const sourceSpanStore = await runSourceSpanStore({
        resourceIngestPath: path.join(outDir, "ingest", "resource-ingest.json"),
        normalizedTextContractPath: path.join(outDir, "normalized-text-contract", "normalized-text-contract.json"),
        extractorAdapterContractPath: path.join(outDir, "extractor-adapter-contract", "extractor-adapter-contract.json"),
        outDir: path.join(outDir, "source-span-store"),
        runAt: "2026-05-23T06:35:07.985Z",
      });
      const sourceSpanStoreSchema = JSON.parse(await readFile("schemas/source-span-store.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(sourceSpanStore, sourceSpanStoreSchema, {}, "source_span_store"),
        [],
      );
      assert.equal(sourceSpanStore.summary.source_span_store_status, "complete");
      assert.equal(sourceSpanStore.summary.normalized_text_artifact_count, normalizedTextContract.summary.normalized_text_artifact_count);
      assert.equal(sourceSpanStore.summary.source_span_seed_count, normalizedTextContract.summary.source_span_seed_count);
      assert.equal(sourceSpanStore.summary.whole_document_span_count, normalizedTextContract.summary.normalized_text_artifact_count);
      assert.equal(sourceSpanStore.summary.page_span_count, normalizedTextContract.summary.normalized_text_artifact_count);
      assert.equal(sourceSpanStore.summary.paragraph_span_count, normalizedTextContract.summary.normalized_text_artifact_count);
      assert.equal(sourceSpanStore.summary.line_span_count, normalizedTextContract.summary.normalized_text_artifact_count);
      assert.equal(sourceSpanStore.summary.char_range_span_count, normalizedTextContract.summary.normalized_text_artifact_count);
      assert.equal(sourceSpanStore.summary.source_span_count, normalizedTextContract.summary.normalized_text_artifact_count * 5);
      assert.equal(sourceSpanStore.summary.source_span_locator_count, sourceSpanStore.summary.source_span_count);
      assert.equal(sourceSpanStore.summary.source_span_location_unit_count, sourceSpanStore.summary.source_span_count);
      assert.equal(sourceSpanStore.summary.extractor_bound_span_count, sourceSpanStore.summary.source_span_count);
      assert.equal(sourceSpanStore.summary.canonical_offset_span_count, sourceSpanStore.summary.source_span_count);
      assert.equal(sourceSpanStore.summary.timestamp_span_count, 0);
      assert.equal(sourceSpanStore.summary.timestamp_not_applicable_count, sourceSpanStore.summary.source_span_count);
      assert.equal(sourceSpanStore.summary.validation_error_count, 0);
      assert.ok(sourceSpanStore.source_span_catalog.source_spans.every((span) => span.schema_version === "source-span.v2"));
      assert.ok(sourceSpanStore.source_span_catalog.source_spans.every((span) => span.locator.offset_unit === "utf16_code_unit"));
      assert.ok(sourceSpanStore.source_span_catalog.source_spans.every((span) => span.timestamp_status === "not_applicable"));
      assert.ok(sourceSpanStore.source_span_catalog.source_spans.every((span) => span.adapter_id && span.extractor_io_contract_id));
      assert.ok(sourceSpanStore.source_span_catalog.source_spans.some((span) => span.location_type === "page"));
      assert.ok(sourceSpanStore.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "source-span-store", "summary.md"), "utf8"), /Source Span Store/);

      const evidenceItemStore = await runEvidenceItemStore({
        sourceSpanStorePath: path.join(outDir, "source-span-store", "source-span-store.json"),
        outDir: path.join(outDir, "evidence-item-store"),
        runAt: "2026-05-23T06:35:07.990Z",
      });
      const evidenceItemStoreSchema = JSON.parse(await readFile("schemas/evidence-item-store.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(evidenceItemStore, evidenceItemStoreSchema, {}, "evidence_item_store"),
        [],
      );
      assert.equal(evidenceItemStore.summary.evidence_item_store_status, "complete");
      assert.equal(evidenceItemStore.summary.source_span_count, sourceSpanStore.summary.source_span_count);
      assert.equal(evidenceItemStore.summary.evidence_item_count, sourceSpanStore.summary.source_span_count);
      assert.equal(evidenceItemStore.summary.evidence_source_span_binding_count, evidenceItemStore.summary.evidence_item_count);
      assert.equal(evidenceItemStore.summary.review_queue_item_count, evidenceItemStore.summary.evidence_item_count);
      assert.equal(evidenceItemStore.summary.source_span_linked_evidence_count, evidenceItemStore.summary.evidence_item_count);
      assert.equal(evidenceItemStore.summary.matter_preserved_evidence_count, evidenceItemStore.summary.evidence_item_count);
      assert.equal(evidenceItemStore.summary.classification_preserved_evidence_count, evidenceItemStore.summary.evidence_item_count);
      assert.equal(evidenceItemStore.summary.policy_snapshot_preserved_evidence_count, evidenceItemStore.summary.evidence_item_count);
      assert.equal(evidenceItemStore.summary.machine_extracted_evidence_count, evidenceItemStore.summary.evidence_item_count);
      assert.equal(evidenceItemStore.summary.needs_review_count, evidenceItemStore.summary.evidence_item_count);
      assert.equal(evidenceItemStore.summary.approved_count, 0);
      assert.equal(evidenceItemStore.summary.validation_error_count, 0);
      assert.ok(evidenceItemStore.evidence_item_catalog.evidence_items.every((item) => item.schema_version === "evidence-item.v2"));
      assert.ok(evidenceItemStore.evidence_item_catalog.evidence_items.every((item) => item.source_span_count === 1 && item.source_span_ids.length === 1));
      assert.ok(evidenceItemStore.evidence_item_catalog.source_span_bindings.every((binding) => binding.binding_status === "bound"));
      assert.ok(evidenceItemStore.evidence_item_catalog.review_queue_items.every((item) => item.review_required === true));
      assert.ok(evidenceItemStore.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "evidence-item-store", "summary.md"), "utf8"), /Evidence Item Store/);

      const factClaimStore = await runFactClaimStore({
        evidenceItemStorePath: path.join(outDir, "evidence-item-store", "evidence-item-store.json"),
        outDir: path.join(outDir, "fact-claim-store"),
        runAt: "2026-05-23T06:35:07.995Z",
      });
      const factClaimStoreSchema = JSON.parse(await readFile("schemas/fact-claim-store.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(factClaimStore, factClaimStoreSchema, {}, "fact_claim_store"),
        [],
      );
      assert.equal(factClaimStore.summary.fact_claim_store_status, "complete");
      assert.equal(factClaimStore.summary.evidence_item_count, evidenceItemStore.summary.evidence_item_count);
      assert.equal(factClaimStore.summary.fact_claim_count, evidenceItemStore.summary.evidence_item_count);
      assert.equal(factClaimStore.summary.fact_evidence_binding_count, factClaimStore.summary.fact_claim_count);
      assert.equal(factClaimStore.summary.review_queue_item_count, factClaimStore.summary.fact_claim_count);
      assert.equal(factClaimStore.summary.evidence_linked_fact_count, factClaimStore.summary.fact_claim_count);
      assert.equal(factClaimStore.summary.reliability_preserved_fact_count, factClaimStore.summary.fact_claim_count);
      assert.equal(factClaimStore.summary.matter_preserved_fact_count, factClaimStore.summary.fact_claim_count);
      assert.equal(factClaimStore.summary.classification_preserved_fact_count, factClaimStore.summary.fact_claim_count);
      assert.equal(factClaimStore.summary.policy_snapshot_preserved_fact_count, factClaimStore.summary.fact_claim_count);
      assert.equal(factClaimStore.summary.machine_extracted_fact_count, factClaimStore.summary.fact_claim_count);
      assert.equal(factClaimStore.summary.needs_review_count, factClaimStore.summary.fact_claim_count);
      assert.equal(factClaimStore.summary.approved_count, 0);
      assert.equal(factClaimStore.summary.validation_error_count, 0);
      assert.ok(factClaimStore.fact_claim_catalog.fact_claims.every((fact) => fact.schema_version === "fact-claim.v2"));
      assert.ok(factClaimStore.fact_claim_catalog.fact_claims.every((fact) => fact.evidence_item_count === 1 && fact.evidence_item_ids.length === 1));
      assert.ok(factClaimStore.fact_claim_catalog.fact_claims.every((fact) => fact.reliability === "machine_extracted" && fact.evidence_reliability === "machine_extracted"));
      assert.ok(factClaimStore.fact_claim_catalog.evidence_bindings.every((binding) => binding.binding_status === "bound" && binding.reliability_preserved));
      assert.ok(factClaimStore.fact_claim_catalog.review_queue_items.every((item) => item.review_required === true));
      assert.ok(factClaimStore.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "fact-claim-store", "summary.md"), "utf8"), /Fact Claim Store/);

      const issueGraphStore = await runIssueGraphStore({
        factClaimStorePath: path.join(outDir, "fact-claim-store", "fact-claim-store.json"),
        outDir: path.join(outDir, "issue-graph-store"),
        runAt: "2026-05-23T06:35:07.997Z",
      });
      const issueGraphStoreSchema = JSON.parse(await readFile("schemas/issue-graph-store.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(issueGraphStore, issueGraphStoreSchema, {}, "issue_graph_store"),
        [],
      );
      assert.equal(issueGraphStore.summary.issue_graph_store_status, "complete");
      assert.equal(issueGraphStore.summary.fact_claim_count, factClaimStore.summary.fact_claim_count);
      assert.equal(issueGraphStore.summary.issue_count, factClaimStore.summary.fact_claim_count);
      assert.equal(issueGraphStore.summary.fact_issue_binding_count, issueGraphStore.summary.issue_count);
      assert.equal(issueGraphStore.summary.legal_rule_binding_count, issueGraphStore.summary.issue_count);
      assert.equal(issueGraphStore.summary.risk_severity_assessment_count, issueGraphStore.summary.issue_count);
      assert.equal(issueGraphStore.summary.review_queue_item_count, issueGraphStore.summary.issue_count);
      assert.equal(issueGraphStore.summary.fact_linked_issue_count, issueGraphStore.summary.issue_count);
      assert.equal(issueGraphStore.summary.legal_rule_linked_issue_count, issueGraphStore.summary.issue_count);
      assert.equal(issueGraphStore.summary.risk_severity_linked_issue_count, issueGraphStore.summary.issue_count);
      assert.equal(issueGraphStore.summary.matter_preserved_issue_count, issueGraphStore.summary.issue_count);
      assert.equal(issueGraphStore.summary.classification_preserved_issue_count, issueGraphStore.summary.issue_count);
      assert.equal(issueGraphStore.summary.policy_snapshot_preserved_issue_count, issueGraphStore.summary.issue_count);
      assert.equal(issueGraphStore.summary.evidence_links_preserved_issue_count, issueGraphStore.summary.issue_count);
      assert.equal(issueGraphStore.summary.needs_review_count, issueGraphStore.summary.issue_count);
      assert.equal(issueGraphStore.summary.approved_count, 0);
      assert.equal(issueGraphStore.summary.validation_error_count, 0);
      assert.ok(issueGraphStore.summary.legal_rule_count > 0);
      assert.ok(issueGraphStore.issue_graph_catalog.issues.every((issue) => issue.schema_version === "issue.v2"));
      assert.ok(issueGraphStore.issue_graph_catalog.issues.every((issue) => issue.linked_fact_count === 1 && issue.legal_rule_count === 1));
      assert.ok(issueGraphStore.issue_graph_catalog.fact_issue_bindings.every((binding) => binding.binding_status === "bound" && binding.evidence_links_preserved));
      assert.ok(issueGraphStore.issue_graph_catalog.legal_rule_bindings.every((binding) => binding.binding_status === "bound" && binding.human_review_required));
      assert.ok(issueGraphStore.issue_graph_catalog.risk_severity_assessments.every((item) => item.human_review_required));
      assert.ok(issueGraphStore.issue_graph_catalog.review_queue_items.every((item) => item.review_required === true));
      assert.ok(issueGraphStore.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "issue-graph-store", "summary.md"), "utf8"), /Issue Graph Store/);

      const citationObjectStore = await runCitationObjectStore({
        issueGraphStorePath: path.join(outDir, "issue-graph-store", "issue-graph-store.json"),
        outDir: path.join(outDir, "citation-object-store"),
        runAt: "2026-05-23T06:35:07.998Z",
      });
      const citationObjectStoreSchema = JSON.parse(await readFile("schemas/citation-object-store.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(citationObjectStore, citationObjectStoreSchema, {}, "citation_object_store"),
        [],
      );
      assert.equal(citationObjectStore.summary.citation_object_store_status, "complete");
      assert.equal(citationObjectStore.summary.issue_count, issueGraphStore.summary.issue_count);
      assert.equal(citationObjectStore.summary.output_paragraph_count, issueGraphStore.summary.issue_count);
      assert.ok(citationObjectStore.summary.citation_count >= citationObjectStore.summary.output_paragraph_count);
      assert.equal(citationObjectStore.summary.paragraph_source_binding_count, citationObjectStore.summary.citation_count);
      assert.equal(citationObjectStore.summary.review_queue_item_count, citationObjectStore.summary.citation_count);
      assert.equal(citationObjectStore.summary.source_span_bound_citation_count, citationObjectStore.summary.citation_count);
      assert.equal(citationObjectStore.summary.issue_linked_citation_count, citationObjectStore.summary.citation_count);
      assert.equal(citationObjectStore.summary.paragraph_linked_citation_count, citationObjectStore.summary.citation_count);
      assert.equal(citationObjectStore.summary.fact_linked_citation_count, citationObjectStore.summary.citation_count);
      assert.equal(citationObjectStore.summary.evidence_linked_citation_count, citationObjectStore.summary.citation_count);
      assert.equal(citationObjectStore.summary.matter_preserved_citation_count, citationObjectStore.summary.citation_count);
      assert.equal(citationObjectStore.summary.classification_preserved_citation_count, citationObjectStore.summary.citation_count);
      assert.equal(citationObjectStore.summary.policy_snapshot_preserved_citation_count, citationObjectStore.summary.citation_count);
      assert.equal(citationObjectStore.summary.issue_link_preserved_citation_count, citationObjectStore.summary.citation_count);
      assert.equal(citationObjectStore.summary.needs_review_count, citationObjectStore.summary.citation_count);
      assert.equal(citationObjectStore.summary.approved_count, 0);
      assert.equal(citationObjectStore.summary.client_facing_ready_count, 0);
      assert.equal(citationObjectStore.summary.not_client_facing_paragraph_count, citationObjectStore.summary.output_paragraph_count);
      assert.equal(citationObjectStore.summary.validation_error_count, 0);
      assert.ok(citationObjectStore.citation_catalog.output_paragraphs.every((paragraph) => paragraph.schema_version === "output-paragraph.v1" && paragraph.client_facing_status === "not_client_facing" && paragraph.citation_count > 0));
      assert.ok(citationObjectStore.citation_catalog.citations.every((citation) => citation.schema_version === "citation.v2" && citation.human_review_required === true && citation.client_facing_ready === false));
      assert.ok(citationObjectStore.citation_catalog.paragraph_source_bindings.every((binding) => binding.binding_status === "bound"));
      assert.ok(citationObjectStore.citation_catalog.review_queue_items.every((item) => item.review_required === true));
      assert.ok(citationObjectStore.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "citation-object-store", "summary.md"), "utf8"), /Citation Object Store/);

      const lineageGraphBuilder = await runLineageGraphBuilder({
        sourceSpanStorePath: path.join(outDir, "source-span-store", "source-span-store.json"),
        evidenceItemStorePath: path.join(outDir, "evidence-item-store", "evidence-item-store.json"),
        factClaimStorePath: path.join(outDir, "fact-claim-store", "fact-claim-store.json"),
        issueGraphStorePath: path.join(outDir, "issue-graph-store", "issue-graph-store.json"),
        citationObjectStorePath: path.join(outDir, "citation-object-store", "citation-object-store.json"),
        outDir: path.join(outDir, "lineage-graph"),
        runAt: "2026-05-23T06:35:07.999Z",
      });
      const lineageGraphBuilderSchema = JSON.parse(await readFile("schemas/lineage-graph-builder.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(lineageGraphBuilder, lineageGraphBuilderSchema, {}, "lineage_graph_builder"),
        [],
      );
      assert.equal(lineageGraphBuilder.summary.lineage_graph_status, "complete");
      assert.equal(lineageGraphBuilder.summary.citation_object_store_status, "complete");
      assert.equal(lineageGraphBuilder.summary.lineage_path_count, lineageGraphBuilder.summary.citation_count);
      assert.equal(lineageGraphBuilder.summary.complete_lineage_path_count, lineageGraphBuilder.summary.lineage_path_count);
      assert.equal(lineageGraphBuilder.summary.broken_lineage_path_count, 0);
      assert.equal(lineageGraphBuilder.summary.source_to_output_path_count, lineageGraphBuilder.summary.lineage_path_count);
      assert.equal(lineageGraphBuilder.summary.citation_bound_lineage_count, lineageGraphBuilder.summary.lineage_path_count);
      assert.equal(lineageGraphBuilder.summary.matter_preserved_path_count, lineageGraphBuilder.summary.lineage_path_count);
      assert.equal(lineageGraphBuilder.summary.classification_preserved_path_count, lineageGraphBuilder.summary.lineage_path_count);
      assert.equal(lineageGraphBuilder.summary.policy_snapshot_preserved_path_count, lineageGraphBuilder.summary.lineage_path_count);
      assert.equal(lineageGraphBuilder.summary.not_client_facing_output_path_count, lineageGraphBuilder.summary.lineage_path_count);
      assert.equal(lineageGraphBuilder.summary.client_facing_ready_path_count, 0);
      assert.equal(lineageGraphBuilder.summary.needs_review_path_count, lineageGraphBuilder.summary.lineage_path_count);
      assert.equal(lineageGraphBuilder.summary.lineage_edge_count, lineageGraphBuilder.summary.lineage_path_count * 5);
      assert.equal(lineageGraphBuilder.summary.expected_lineage_edge_count, lineageGraphBuilder.summary.lineage_edge_count);
      assert.equal(lineageGraphBuilder.summary.validation_error_count, 0);
      assert.ok(lineageGraphBuilder.lineage_graph_catalog.lineage_paths.every((lineagePath) => lineagePath.path_status === "complete" && lineagePath.edge_ids.length === 5));
      assert.ok(lineageGraphBuilder.lineage_graph_catalog.lineage_edges.every((edge) => edge.edge_status === "complete"));
      assert.deepEqual(
        new Set(lineageGraphBuilder.lineage_graph_catalog.lineage_nodes.map((node) => node.node_type)),
        new Set(["source_span", "evidence_item", "fact_claim", "issue", "output_paragraph"]),
      );
      assert.match(await readFile(path.join(outDir, "lineage-graph", "summary.md"), "utf8"), /Lineage Graph Builder/);

      const evidenceCoverageScore = await runEvidenceCoverageScore({
        lineageGraphPath: path.join(outDir, "lineage-graph", "lineage-graph.json"),
        sourceSpanStorePath: path.join(outDir, "source-span-store", "source-span-store.json"),
        evidenceItemStorePath: path.join(outDir, "evidence-item-store", "evidence-item-store.json"),
        factClaimStorePath: path.join(outDir, "fact-claim-store", "fact-claim-store.json"),
        issueGraphStorePath: path.join(outDir, "issue-graph-store", "issue-graph-store.json"),
        citationObjectStorePath: path.join(outDir, "citation-object-store", "citation-object-store.json"),
        outDir: path.join(outDir, "evidence-coverage"),
        runAt: "2026-05-23T06:35:08.000Z",
      });
      const evidenceCoverageScoreSchema = JSON.parse(await readFile("schemas/evidence-coverage-score.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(evidenceCoverageScore, evidenceCoverageScoreSchema, {}, "evidence_coverage_score"),
        [],
      );
      assert.equal(evidenceCoverageScore.summary.evidence_coverage_status, "complete");
      assert.equal(evidenceCoverageScore.summary.lineage_graph_status, "complete");
      assert.equal(evidenceCoverageScore.summary.coverage_score_count, lineageGraphBuilder.summary.lineage_path_count);
      assert.equal(evidenceCoverageScore.summary.coverage_dimension_count, evidenceCoverageScore.summary.coverage_score_count * 5);
      assert.equal(evidenceCoverageScore.summary.claim_dimension_count, evidenceCoverageScore.summary.coverage_score_count);
      assert.equal(evidenceCoverageScore.summary.claim_covered_count, evidenceCoverageScore.summary.coverage_score_count);
      assert.equal(evidenceCoverageScore.summary.legal_basis_dimension_count, evidenceCoverageScore.summary.coverage_score_count);
      assert.equal(evidenceCoverageScore.summary.legal_basis_covered_count, evidenceCoverageScore.summary.coverage_score_count);
      assert.equal(evidenceCoverageScore.summary.date_dimension_count, evidenceCoverageScore.summary.coverage_score_count);
      assert.equal(evidenceCoverageScore.summary.party_dimension_count, evidenceCoverageScore.summary.coverage_score_count);
      assert.equal(evidenceCoverageScore.summary.amount_dimension_count, evidenceCoverageScore.summary.coverage_score_count);
      assert.equal(
        evidenceCoverageScore.summary.coverage_score_count,
        evidenceCoverageScore.summary.full_coverage_score_count + evidenceCoverageScore.summary.partial_coverage_score_count,
      );
      assert.equal(evidenceCoverageScore.summary.matter_preserved_score_count, evidenceCoverageScore.summary.coverage_score_count);
      assert.equal(evidenceCoverageScore.summary.classification_preserved_score_count, evidenceCoverageScore.summary.coverage_score_count);
      assert.equal(evidenceCoverageScore.summary.policy_snapshot_preserved_score_count, evidenceCoverageScore.summary.coverage_score_count);
      assert.equal(evidenceCoverageScore.summary.needs_review_score_count, evidenceCoverageScore.summary.coverage_score_count);
      assert.equal(evidenceCoverageScore.summary.not_client_facing_output_score_count, evidenceCoverageScore.summary.coverage_score_count);
      assert.equal(evidenceCoverageScore.summary.client_facing_ready_score_count, 0);
      assert.equal(evidenceCoverageScore.summary.validation_error_count, 0);
      assert.ok(evidenceCoverageScore.evidence_coverage_catalog.coverage_scores.every((score) => score.coverage_dimensions.length === 5 && score.review_status === "needs_review"));
      assert.ok(evidenceCoverageScore.evidence_coverage_catalog.coverage_dimensions.every((dimension) => ["covered", "missing", "not_applicable"].includes(dimension.coverage_status)));
      assert.match(await readFile(path.join(outDir, "evidence-coverage", "summary.md"), "utf8"), /Evidence Coverage Score/);

      const evidenceFlags = await runEvidenceFlags({
        evidenceCoveragePath: path.join(outDir, "evidence-coverage", "evidence-coverage-score.json"),
        sourceSpanStorePath: path.join(outDir, "source-span-store", "source-span-store.json"),
        evidenceItemStorePath: path.join(outDir, "evidence-item-store", "evidence-item-store.json"),
        factClaimStorePath: path.join(outDir, "fact-claim-store", "fact-claim-store.json"),
        issueGraphStorePath: path.join(outDir, "issue-graph-store", "issue-graph-store.json"),
        outDir: path.join(outDir, "evidence-flags"),
        runAt: "2026-05-23T06:35:08.001Z",
      });
      const evidenceFlagsSchema = JSON.parse(await readFile("schemas/evidence-flags.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(evidenceFlags, evidenceFlagsSchema, {}, "evidence_flags"),
        [],
      );
      assert.equal(evidenceFlags.summary.evidence_flags_status, "complete");
      assert.equal(evidenceFlags.summary.evidence_coverage_status, "complete");
      assert.equal(evidenceFlags.summary.evidence_flag_record_count, evidenceCoverageScore.summary.coverage_score_count);
      assert.equal(evidenceFlags.summary.coverage_score_count, evidenceFlags.summary.evidence_flag_record_count);
      assert.equal(evidenceFlags.summary.flag_decision_count, evidenceFlags.summary.evidence_flag_record_count * 5);
      assert.equal(evidenceFlags.summary.machine_extracted_count, evidenceFlags.summary.evidence_flag_record_count);
      assert.equal(evidenceFlags.summary.pending_human_confirmation_count, evidenceFlags.summary.evidence_flag_record_count);
      assert.equal(evidenceFlags.summary.matter_preserved_record_count, evidenceFlags.summary.evidence_flag_record_count);
      assert.equal(evidenceFlags.summary.classification_preserved_record_count, evidenceFlags.summary.evidence_flag_record_count);
      assert.equal(evidenceFlags.summary.policy_snapshot_preserved_record_count, evidenceFlags.summary.evidence_flag_record_count);
      assert.equal(evidenceFlags.summary.needs_review_record_count, evidenceFlags.summary.evidence_flag_record_count);
      assert.equal(evidenceFlags.summary.not_client_facing_record_count, evidenceFlags.summary.evidence_flag_record_count);
      assert.equal(evidenceFlags.summary.client_facing_ready_record_count, 0);
      assert.equal(evidenceFlags.summary.validation_error_count, 0);
      assert.ok(evidenceFlags.evidence_flag_catalog.evidence_flag_records.every((record) => record.flag_decisions.length === 5 && record.review_status === "needs_review"));
      assert.ok(evidenceFlags.evidence_flag_catalog.evidence_flag_records.every((record) => record.extraction_flag === "machine_extracted" && record.human_confirmation_flag === "pending_human_confirmation"));
      assert.ok(evidenceFlags.evidence_flag_catalog.flag_decisions.every((decision) => ["extraction", "human_confirmation", "privilege", "redaction", "external_transfer"].includes(decision.flag_type)));
      assert.ok(evidenceFlags.evidence_flag_catalog.evidence_flag_records.every((record) => ["redaction_required", "redaction_review_required", "redaction_not_required"].includes(record.redaction_flag)));
      assert.ok(evidenceFlags.evidence_flag_catalog.evidence_flag_records.every((record) => ["external_transfer_blocked", "external_transfer_requires_approval", "external_transfer_allowed_by_classification"].includes(record.external_transfer_flag)));
      assert.match(await readFile(path.join(outDir, "evidence-flags", "summary.md"), "utf8"), /Evidence Flags/);

      const exhibitMap = await runExhibitMap({
        evidenceFlagsPath: path.join(outDir, "evidence-flags", "evidence-flags.json"),
        citationObjectStorePath: path.join(outDir, "citation-object-store", "citation-object-store.json"),
        lineageGraphPath: path.join(outDir, "lineage-graph", "lineage-graph.json"),
        evidenceCoveragePath: path.join(outDir, "evidence-coverage", "evidence-coverage-score.json"),
        outDir: path.join(outDir, "exhibit-map"),
        runAt: "2026-05-23T06:35:08.002Z",
      });
      const exhibitMapSchema = JSON.parse(await readFile("schemas/exhibit-map.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(exhibitMap, exhibitMapSchema, {}, "exhibit_map"),
        [],
      );
      assert.equal(exhibitMap.summary.exhibit_map_status, "complete");
      assert.equal(exhibitMap.summary.evidence_flags_status, "complete");
      assert.equal(exhibitMap.summary.exhibit_record_count, evidenceFlags.summary.evidence_flag_record_count);
      assert.equal(exhibitMap.summary.citation_count, exhibitMap.summary.exhibit_record_count);
      assert.equal(exhibitMap.summary.lineage_path_count, exhibitMap.summary.exhibit_record_count);
      assert.equal(exhibitMap.summary.coverage_score_count, exhibitMap.summary.exhibit_record_count);
      assert.equal(exhibitMap.summary.exhibit_binding_count, exhibitMap.summary.exhibit_record_count * 4);
      assert.equal(exhibitMap.summary.expected_exhibit_binding_count, exhibitMap.summary.exhibit_binding_count);
      assert.equal(exhibitMap.summary.unique_exhibit_number_count, exhibitMap.summary.exhibit_record_count);
      assert.equal(exhibitMap.summary.evidence_linked_exhibit_count, exhibitMap.summary.exhibit_record_count);
      assert.equal(exhibitMap.summary.citation_linked_exhibit_count, exhibitMap.summary.exhibit_record_count);
      assert.equal(exhibitMap.summary.output_paragraph_linked_exhibit_count, exhibitMap.summary.exhibit_record_count);
      assert.equal(exhibitMap.summary.lineage_path_linked_exhibit_count, exhibitMap.summary.exhibit_record_count);
      assert.equal(exhibitMap.summary.matter_preserved_exhibit_count, exhibitMap.summary.exhibit_record_count);
      assert.equal(exhibitMap.summary.classification_preserved_exhibit_count, exhibitMap.summary.exhibit_record_count);
      assert.equal(exhibitMap.summary.policy_snapshot_preserved_exhibit_count, exhibitMap.summary.exhibit_record_count);
      assert.equal(exhibitMap.summary.needs_review_exhibit_count, exhibitMap.summary.exhibit_record_count);
      assert.equal(exhibitMap.summary.attorney_review_required_exhibit_count, exhibitMap.summary.exhibit_record_count);
      assert.equal(exhibitMap.summary.not_client_facing_exhibit_count, exhibitMap.summary.exhibit_record_count);
      assert.equal(exhibitMap.summary.client_facing_ready_exhibit_count, 0);
      assert.equal(exhibitMap.summary.validation_error_count, 0);
      assert.ok(exhibitMap.exhibit_catalog.exhibit_records.every((record) => record.exhibit_reference.startsWith("별첨 ")));
      assert.ok(exhibitMap.exhibit_catalog.exhibit_records.every((record) => record.exhibit_label.startsWith("EX-") && record.exhibit_binding_ids.length === 4));
      assert.ok(exhibitMap.exhibit_catalog.exhibit_records.every((record) => record.human_review_required === true && record.attorney_review_required === true && record.client_facing_ready === false));
      assert.ok(exhibitMap.exhibit_catalog.exhibit_bindings.every((binding) => binding.binding_status === "bound"));
      assert.match(await readFile(path.join(outDir, "exhibit-map", "summary.md"), "utf8"), /Exhibit Map/);

      const chainOfCustodyEvents = await runChainOfCustodyEvents({
        resourceStoreInterfacePath: path.join(outDir, "resource-store-interface", "resource-store-interface.json"),
        resourceVersionLedgerPath: path.join(outDir, "resource-version-ledger", "resource-version-ledger.json"),
        normalizedTextContractPath: path.join(outDir, "normalized-text-contract", "normalized-text-contract.json"),
        sourceSpanStorePath: path.join(outDir, "source-span-store", "source-span-store.json"),
        evidenceItemStorePath: path.join(outDir, "evidence-item-store", "evidence-item-store.json"),
        factClaimStorePath: path.join(outDir, "fact-claim-store", "fact-claim-store.json"),
        issueGraphStorePath: path.join(outDir, "issue-graph-store", "issue-graph-store.json"),
        citationObjectStorePath: path.join(outDir, "citation-object-store", "citation-object-store.json"),
        lineageGraphPath: path.join(outDir, "lineage-graph", "lineage-graph.json"),
        evidenceFlagsPath: path.join(outDir, "evidence-flags", "evidence-flags.json"),
        exhibitMapPath: path.join(outDir, "exhibit-map", "exhibit-map.json"),
        outDir: path.join(outDir, "chain-of-custody"),
        runAt: "2026-05-23T06:35:08.003Z",
      });
      const custodyEventsSchema = JSON.parse(await readFile("schemas/chain-of-custody-events.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(chainOfCustodyEvents, custodyEventsSchema, {}, "chain_of_custody_events"),
        [],
      );
      assert.equal(chainOfCustodyEvents.summary.custody_event_ledger_status, "complete");
      assert.equal(chainOfCustodyEvents.summary.resource_version_count, resourceVersionLedger.summary.resource_version_count);
      assert.equal(chainOfCustodyEvents.summary.normalized_text_artifact_count, normalizedTextContract.summary.normalized_text_artifact_count);
      assert.equal(chainOfCustodyEvents.summary.exhibit_record_count, exhibitMap.summary.exhibit_record_count);
      assert.equal(chainOfCustodyEvents.summary.upload_event_count, resourceVersionLedger.summary.resource_version_count);
      assert.equal(chainOfCustodyEvents.summary.normalize_event_count, normalizedTextContract.summary.normalized_text_artifact_count);
      assert.equal(chainOfCustodyEvents.summary.extract_event_count, exhibitMap.summary.exhibit_record_count);
      assert.equal(chainOfCustodyEvents.summary.review_event_count, exhibitMap.summary.exhibit_record_count);
      assert.equal(chainOfCustodyEvents.summary.approve_event_count, exhibitMap.summary.exhibit_record_count);
      assert.equal(
        chainOfCustodyEvents.summary.custody_event_count,
        chainOfCustodyEvents.summary.upload_event_count + chainOfCustodyEvents.summary.normalize_event_count + chainOfCustodyEvents.summary.extract_event_count + chainOfCustodyEvents.summary.review_event_count + chainOfCustodyEvents.summary.approve_event_count,
      );
      assert.equal(chainOfCustodyEvents.summary.custody_event_link_count, chainOfCustodyEvents.summary.custody_event_count);
      assert.equal(chainOfCustodyEvents.summary.append_only_event_count, chainOfCustodyEvents.summary.custody_event_count);
      assert.equal(chainOfCustodyEvents.summary.hashed_event_count, chainOfCustodyEvents.summary.custody_event_count);
      assert.equal(chainOfCustodyEvents.summary.previous_hash_linked_event_count, chainOfCustodyEvents.summary.custody_event_count);
      assert.equal(chainOfCustodyEvents.summary.complete_resource_chain_count, resourceVersionLedger.summary.resource_version_count);
      assert.equal(chainOfCustodyEvents.summary.complete_evidence_chain_count, exhibitMap.summary.exhibit_record_count);
      assert.equal(chainOfCustodyEvents.summary.matter_preserved_event_count, chainOfCustodyEvents.summary.custody_event_count);
      assert.equal(chainOfCustodyEvents.summary.classification_preserved_event_count, chainOfCustodyEvents.summary.custody_event_count);
      assert.equal(chainOfCustodyEvents.summary.policy_snapshot_preserved_event_count, chainOfCustodyEvents.summary.custody_event_count);
      assert.equal(chainOfCustodyEvents.summary.pending_approval_event_count, exhibitMap.summary.exhibit_record_count);
      assert.equal(chainOfCustodyEvents.summary.approved_event_count, 0);
      assert.equal(chainOfCustodyEvents.summary.client_facing_ready_event_count, 0);
      assert.equal(chainOfCustodyEvents.summary.validation_error_count, 0);
      assert.ok(chainOfCustodyEvents.custody_event_catalog.custody_events.every((event) => event.append_only === true && event.immutable === true && event.event_hash));
      assert.ok(chainOfCustodyEvents.custody_event_catalog.custody_events.filter((event) => event.event_stage === "review" || event.event_stage === "approve").every((event) => event.actor.human_approval_actor_required === true));
      assert.match(await readFile(path.join(outDir, "chain-of-custody", "summary.md"), "utf8"), /Chain of Custody Events/);

      const searchIndexContract = await runSearchIndexContract({
        resourceStoreInterfacePath: path.join(outDir, "resource-store-interface", "resource-store-interface.json"),
        normalizedTextContractPath: path.join(outDir, "normalized-text-contract", "normalized-text-contract.json"),
        sourceSpanStorePath: path.join(outDir, "source-span-store", "source-span-store.json"),
        evidenceItemStorePath: path.join(outDir, "evidence-item-store", "evidence-item-store.json"),
        factClaimStorePath: path.join(outDir, "fact-claim-store", "fact-claim-store.json"),
        issueGraphStorePath: path.join(outDir, "issue-graph-store", "issue-graph-store.json"),
        citationObjectStorePath: path.join(outDir, "citation-object-store", "citation-object-store.json"),
        lineageGraphPath: path.join(outDir, "lineage-graph", "lineage-graph.json"),
        exhibitMapPath: path.join(outDir, "exhibit-map", "exhibit-map.json"),
        chainOfCustodyEventsPath: path.join(outDir, "chain-of-custody", "chain-of-custody-events.json"),
        outDir: path.join(outDir, "search-index"),
        runAt: "2026-05-23T06:35:08.004Z",
      });
      const searchIndexContractSchema = JSON.parse(await readFile("schemas/search-index-contract.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(searchIndexContract, searchIndexContractSchema, {}, "search_index_contract"),
        [],
      );
      assert.equal(searchIndexContract.summary.search_index_contract_status, "complete");
      assert.equal(searchIndexContract.summary.search_index_manifest_count, searchIndexContract.summary.source_collection_count);
      assert.equal(searchIndexContract.summary.search_index_query_plan_count, searchIndexContract.summary.search_index_manifest_count);
      assert.equal(searchIndexContract.summary.required_filter_field_count, searchIndexContract.summary.search_index_manifest_count * 4);
      assert.equal(searchIndexContract.summary.filters_enforced_query_plan_count, searchIndexContract.summary.search_index_query_plan_count);
      assert.equal(searchIndexContract.summary.tenant_filter_required_query_plan_count, searchIndexContract.summary.search_index_query_plan_count);
      assert.equal(searchIndexContract.summary.matter_filter_required_query_plan_count, searchIndexContract.summary.search_index_query_plan_count);
      assert.equal(searchIndexContract.summary.classification_filter_required_query_plan_count, searchIndexContract.summary.search_index_query_plan_count);
      assert.equal(searchIndexContract.summary.policy_snapshot_filter_required_query_plan_count, searchIndexContract.summary.search_index_query_plan_count);
      assert.equal(searchIndexContract.summary.pre_retrieval_gate_required_query_plan_count, searchIndexContract.summary.search_index_query_plan_count);
      assert.equal(searchIndexContract.summary.matter_wall_enforced_query_plan_count, searchIndexContract.summary.search_index_query_plan_count);
      assert.equal(searchIndexContract.summary.classification_enforced_query_plan_count, searchIndexContract.summary.search_index_query_plan_count);
      assert.equal(searchIndexContract.summary.policy_snapshot_bound_query_plan_count, searchIndexContract.summary.search_index_query_plan_count);
      assert.equal(searchIndexContract.summary.held_query_plan_count, searchIndexContract.summary.search_index_query_plan_count);
      assert.equal(searchIndexContract.summary.executable_query_plan_count, 0);
      assert.equal(searchIndexContract.summary.source_ref_preserved_query_plan_count, searchIndexContract.summary.search_index_query_plan_count);
      assert.equal(searchIndexContract.summary.validation_error_count, 0);
      assert.ok(searchIndexContract.search_index_catalog.search_index_manifests.every((manifest) => ["tenant_id", "matter_id", "classification", "policy_snapshot_id"].every((filterName) => manifest.required_query_filters.includes(filterName))));
      assert.ok(searchIndexContract.search_index_catalog.search_index_query_plans.every((plan) => plan.executable === false && plan.query_status === "held_for_retrieval_filter_compiler"));
      assert.match(await readFile(path.join(outDir, "search-index", "summary.md"), "utf8"), /Search Index Contract/);

      const contractGoldenFixtures = await runContractGoldenFixtures({
        artifactPaths: {
          contract_inventory: path.join(outDir, "contract-inventory", "contract-inventory.json"),
          contract_dependency_map: path.join(outDir, "contract-dependency-map", "contract-dependency-map.json"),
          schema_versioning_rules: path.join(outDir, "schema-versioning-rules", "schema-versioning-rules.json"),
          schema_migration_manifest: path.join(outDir, "schema-migration-manifest", "schema-migration-manifest-ledger.json"),
          identity_model: path.join(outDir, "identity-model", "identity-model.json"),
          client_counterparty_registry: path.join(outDir, "client-counterparty-registry", "client-counterparty-registry.json"),
          matter_profile_team_ledger: path.join(outDir, "matter-profile-team-ledger", "matter-profile-team-ledger.json"),
          wall_policy_contract: path.join(outDir, "wall-policy-contract", "wall-policy-contract.json"),
          matter_access_policy_evaluator: path.join(outDir, "matter-access-policy", "matter-access-policy-evaluator.json"),
          data_classification_rule_engine: path.join(outDir, "data-classification-rules", "data-classification-rule-engine.json"),
          matter_tagging_decision_ledger: path.join(outDir, "matter-tagging", "matter-tagging-ledger.json"),
          access_audit_projection: path.join(outDir, "access-audit", "access-audit-projection.json"),
          store_policy_adapter: path.join(outDir, "store-policy", "store-policy-adapter.json"),
          conflict_check_interface: path.join(outDir, "conflict-check", "conflict-check-interface.json"),
          personal_workspace_boundary: path.join(outDir, "personal-workspace-boundary", "personal-workspace-boundary.json"),
          policy_golden_fixtures: path.join(outDir, "policy-golden-fixtures", "policy-golden-fixtures.json"),
          policy_operations_surface: path.join(outDir, "policy-operations-surface", "policy-operations-surface.json"),
          matter_boundary_slice: path.join(outDir, "matter-boundary-slice", "matter-boundary-slice.json"),
          identity_policy_matter_freeze: path.join(outDir, "identity-policy-matter-freeze", "identity-policy-matter-freeze.json"),
          resource_store_interface: path.join(outDir, "resource-store-interface", "resource-store-interface.json"),
          immutable_object_store_layout: path.join(outDir, "immutable-object-store-layout", "immutable-object-store-layout.json"),
          resource_version_ledger: path.join(outDir, "resource-version-ledger", "resource-version-ledger.json"),
          normalized_text_contract: path.join(outDir, "normalized-text-contract", "normalized-text-contract.json"),
          extractor_adapter_contract: path.join(outDir, "extractor-adapter-contract", "extractor-adapter-contract.json"),
          source_span_store: path.join(outDir, "source-span-store", "source-span-store.json"),
          evidence_item_store: path.join(outDir, "evidence-item-store", "evidence-item-store.json"),
          fact_claim_store: path.join(outDir, "fact-claim-store", "fact-claim-store.json"),
          issue_graph_store: path.join(outDir, "issue-graph-store", "issue-graph-store.json"),
          citation_object_store: path.join(outDir, "citation-object-store", "citation-object-store.json"),
          lineage_graph_builder: path.join(outDir, "lineage-graph", "lineage-graph.json"),
          evidence_coverage_score: path.join(outDir, "evidence-coverage", "evidence-coverage-score.json"),
          evidence_flags: path.join(outDir, "evidence-flags", "evidence-flags.json"),
          exhibit_map: path.join(outDir, "exhibit-map", "exhibit-map.json"),
          chain_of_custody_events: path.join(outDir, "chain-of-custody", "chain-of-custody-events.json"),
          search_index_contract: path.join(outDir, "search-index", "search-index-contract.json"),
          model_policy_enforcement: path.join(outDir, "model-policy-enforcement", "model-policy-enforcement.json"),
          tool_runtime_policy_enforcement: path.join(outDir, "tool-runtime-policy", "tool-runtime-policy-enforcement.json"),
          output_destination_policy_enforcement: path.join(outDir, "output-destination-policy", "output-destination-policy-enforcement.json"),
          approval_authority_ledger: path.join(outDir, "approval-authority", "approval-authority-ledger.json"),
          resource_contract_freeze: path.join(outDir, "resource-contract-freeze", "resource-contract-freeze.json"),
          matter_contract_freeze: path.join(outDir, "matter-contract-freeze", "matter-contract-freeze.json"),
          policy_contract_freeze: path.join(outDir, "policy-contract-freeze", "policy-contract-freeze.json"),
          evidence_contract_freeze: path.join(outDir, "evidence-contract-freeze", "evidence-contract-freeze.json"),
          capability_workflow_contract_freeze: path.join(outDir, "capability-workflow-contract-freeze", "capability-workflow-contract-freeze.json"),
          runtime_agentrun_contract_freeze: path.join(outDir, "runtime-agentrun-contract-freeze", "runtime-agentrun-contract-freeze.json"),
          gate_approval_contract_freeze: path.join(outDir, "gate-approval-contract-freeze", "gate-approval-contract-freeze.json"),
          output_delivery_contract_freeze: path.join(outDir, "output-delivery-contract-freeze", "output-delivery-contract-freeze.json"),
          event_audit_run_contract_freeze: path.join(outDir, "event-audit-run-contract-freeze", "event-audit-run-contract-freeze.json"),
          policy_snapshot_binding_ledger: path.join(outDir, "policy-snapshot-bindings", "policy-snapshot-binding-ledger.json"),
          error_cost_observability_contract_freeze: path.join(outDir, "error-cost-observability-contract-freeze", "error-cost-observability-contract-freeze.json"),
        },
        outDir: path.join(outDir, "contract-golden-fixtures"),
        runAt: "2026-05-23T06:35:08.000Z",
      });
      const contractGoldenFixturesSchema = JSON.parse(await readFile("schemas/contract-golden-fixtures.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(contractGoldenFixtures, contractGoldenFixturesSchema, {}, "contract_golden_fixtures"),
        [],
      );
      assert.equal(contractGoldenFixtures.summary.golden_fixture_status, "complete");
      assert.equal(contractGoldenFixtures.summary.fixture_count, 50);
      assert.equal(contractGoldenFixtures.summary.required_fixture_count, 50);
      assert.equal(contractGoldenFixtures.summary.locked_fixture_count, contractGoldenFixtures.summary.fixture_count);
      assert.equal(contractGoldenFixtures.summary.schema_valid_fixture_count, contractGoldenFixtures.summary.fixture_count);
      assert.equal(contractGoldenFixtures.summary.schema_invalid_fixture_count, 0);
      assert.equal(contractGoldenFixtures.summary.regression_hash_count, contractGoldenFixtures.summary.fixture_count);
      assert.equal(contractGoldenFixtures.summary.locked_regression_hash_count, contractGoldenFixtures.summary.fixture_count);
      assert.equal(contractGoldenFixtures.summary.missing_artifact_count, 0);
      assert.equal(contractGoldenFixtures.summary.schema_version_present_count, contractGoldenFixtures.summary.fixture_count);
      assert.equal(contractGoldenFixtures.summary.validation_error_count, 0);
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "resource_contract_freeze"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "identity_model"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "client_counterparty_registry"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "matter_profile_team_ledger"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "wall_policy_contract"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "matter_access_policy_evaluator"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "data_classification_rule_engine"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "matter_tagging_decision_ledger"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "access_audit_projection"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "store_policy_adapter"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "conflict_check_interface"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "personal_workspace_boundary"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "policy_golden_fixtures"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "policy_operations_surface"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "matter_boundary_slice"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "identity_policy_matter_freeze"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "resource_store_interface"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "immutable_object_store_layout"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "resource_version_ledger"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "normalized_text_contract"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "extractor_adapter_contract"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "source_span_store"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "evidence_item_store"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "fact_claim_store"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "issue_graph_store"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "citation_object_store"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "lineage_graph_builder"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "evidence_coverage_score"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "evidence_flags"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "exhibit_map"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "chain_of_custody_events"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "search_index_contract"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "model_policy_enforcement"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "tool_runtime_policy_enforcement"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "output_destination_policy_enforcement"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "approval_authority_ledger"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "policy_snapshot_binding_ledger"));
      assert.ok(contractGoldenFixtures.golden_fixtures.some((fixture) => fixture.fixture_id === "schema_migration_manifest"));
      assert.ok(contractGoldenFixtures.golden_fixtures.every((fixture) => fixture.content_hash?.startsWith("sha256:")));
      assert.ok(contractGoldenFixtures.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "contract-golden-fixtures", "summary.md"), "utf8"), /Contract Golden Fixtures/);

      const contractValidationSuite = await runContractValidationSuite({
        contractGoldenFixturesPath: path.join(outDir, "contract-golden-fixtures", "contract-golden-fixtures.json"),
        packagePath: "package.json",
        roadmapPath: "docs/implementation-roadmap.md",
        outDir: path.join(outDir, "contract-validation-suite"),
        runAt: "2026-05-23T06:35:08.000Z",
      });
      const contractValidationSuiteSchema = JSON.parse(await readFile("schemas/contract-validation-suite.schema.json", "utf8"));
      assert.deepEqual(
        validateAgainstSchema(contractValidationSuite, contractValidationSuiteSchema, {}, "contract_validation_suite"),
        [],
      );
      assert.equal(contractValidationSuite.summary.validation_suite_status, "complete");
      assert.equal(contractValidationSuite.summary.fixture_count, contractGoldenFixtures.summary.fixture_count);
      assert.equal(contractValidationSuite.summary.validated_fixture_count, contractGoldenFixtures.summary.fixture_count);
      assert.equal(contractValidationSuite.summary.schema_valid_fixture_count, contractGoldenFixtures.summary.fixture_count);
      assert.equal(contractValidationSuite.summary.schema_invalid_fixture_count, 0);
      assert.equal(contractValidationSuite.summary.regression_passed_count, contractGoldenFixtures.summary.fixture_count);
      assert.equal(contractValidationSuite.summary.regression_failed_count, 0);
      assert.equal(contractValidationSuite.summary.content_hash_match_count, contractGoldenFixtures.summary.fixture_count);
      assert.equal(contractValidationSuite.summary.content_hash_mismatch_count, 0);
      assert.equal(contractValidationSuite.summary.schema_hash_match_count, contractGoldenFixtures.summary.fixture_count);
      assert.equal(contractValidationSuite.summary.schema_hash_mismatch_count, 0);
      assert.equal(contractValidationSuite.summary.missing_package_script_count, 0);
      assert.equal(contractValidationSuite.summary.roadmap_missing_count, 0);
      assert.equal(contractValidationSuite.summary.validation_error_count, 0);
      assert.ok(contractValidationSuite.fixture_validation_results.every((result) => result.regression_status === "passed"));
      assert.ok(contractValidationSuite.validation_command_manifest.required_package_scripts.some((script) => script.package_script_name === "contracts:validate"));
      assert.ok(contractValidationSuite.validation_command_manifest.required_package_scripts.some((script) => script.package_script_name === "contracts:tool-runtime"));
      assert.ok(contractValidationSuite.validation_command_manifest.required_package_scripts.some((script) => script.package_script_name === "resource:evidence-coverage"));
      assert.ok(contractValidationSuite.validation_command_manifest.required_package_scripts.some((script) => script.package_script_name === "resource:evidence-flags"));
      assert.ok(contractValidationSuite.validation_command_manifest.required_package_scripts.some((script) => script.package_script_name === "resource:exhibit-map"));
      assert.ok(contractValidationSuite.validation_command_manifest.required_package_scripts.some((script) => script.package_script_name === "resource:custody-events"));
      assert.ok(contractValidationSuite.validation_command_manifest.required_package_scripts.some((script) => script.package_script_name === "resource:search-index"));
      assert.ok(contractValidationSuite.validation_command_manifest.required_package_scripts.some((script) => script.package_script_name === "contracts:output-destination"));
      assert.ok(contractValidationSuite.validation_command_manifest.required_package_scripts.some((script) => script.package_script_name === "contracts:approval-authority"));
      assert.ok(contractValidationSuite.validation_command_manifest.required_package_scripts.some((script) => script.package_script_name === "contracts:policy-bindings"));
      assert.ok(contractValidationSuite.validation_command_manifest.required_package_scripts.some((script) => script.package_script_name === "contracts:matter-tagging"));
      assert.ok(contractValidationSuite.validation_command_manifest.required_package_scripts.some((script) => script.package_script_name === "contracts:access-audit"));
      assert.ok(contractValidationSuite.validation_command_manifest.required_package_scripts.some((script) => script.package_script_name === "contracts:store-policy"));
      assert.ok(contractValidationSuite.validation_command_manifest.required_package_scripts.some((script) => script.package_script_name === "contracts:conflict-check"));
      assert.ok(contractValidationSuite.validation_command_manifest.required_package_scripts.some((script) => script.package_script_name === "contracts:personal-boundary"));
      assert.ok(contractValidationSuite.validation_command_manifest.required_package_scripts.some((script) => script.package_script_name === "contracts:policy-golden"));
      assert.ok(contractValidationSuite.validation_command_manifest.required_package_scripts.some((script) => script.package_script_name === "resource:source-spans"));
      assert.ok(contractValidationSuite.validation_command_manifest.required_package_scripts.some((script) => script.package_script_name === "resource:evidence-items"));
      assert.ok(contractValidationSuite.validation_command_manifest.required_package_scripts.some((script) => script.package_script_name === "resource:fact-claims"));
      assert.ok(contractValidationSuite.validation_command_manifest.required_package_scripts.some((script) => script.package_script_name === "resource:issue-graph"));
      assert.ok(contractValidationSuite.validation_command_manifest.required_package_scripts.some((script) => script.package_script_name === "resource:citations"));
      assert.ok(contractValidationSuite.validation_command_manifest.required_package_scripts.some((script) => script.package_script_name === "resource:lineage-graph"));
      assert.ok(contractValidationSuite.validation_items.every((item) => item.status === "passed"));
      assert.match(await readFile(path.join(outDir, "contract-validation-suite", "summary.md"), "utf8"), /Contract Validation Suite/);

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
      const contractInventoryCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-contract-inventory");
      assert.equal(contractInventoryCheckpoint?.acceptance_profile, "contract_inventory_gate");
      assert.equal(contractInventoryCheckpoint?.status, "passed");
      assert.equal(contractInventoryCheckpoint?.implementation_status, "passed");
      const contractDependencyMapCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-contract-dependency-map");
      assert.equal(contractDependencyMapCheckpoint?.acceptance_profile, "contract_dependency_map_gate");
      assert.equal(contractDependencyMapCheckpoint?.status, "passed");
      assert.equal(contractDependencyMapCheckpoint?.implementation_status, "passed");
      const schemaVersioningRulesCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-schema-versioning-rules");
      assert.equal(schemaVersioningRulesCheckpoint?.acceptance_profile, "schema_versioning_rules_gate");
      assert.equal(schemaVersioningRulesCheckpoint?.status, "passed");
      assert.equal(schemaVersioningRulesCheckpoint?.implementation_status, "passed");
      const schemaMigrationManifestCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-schema-migration-manifest");
      assert.equal(schemaMigrationManifestCheckpoint?.acceptance_profile, "schema_migration_manifest_gate");
      assert.equal(schemaMigrationManifestCheckpoint?.status, "passed");
      assert.equal(schemaMigrationManifestCheckpoint?.implementation_status, "passed");
      const contractGoldenFixturesCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-contract-golden-fixtures");
      assert.equal(contractGoldenFixturesCheckpoint?.acceptance_profile, "contract_golden_fixtures_gate");
      assert.equal(contractGoldenFixturesCheckpoint?.status, "passed");
      assert.equal(contractGoldenFixturesCheckpoint?.implementation_status, "passed");
      const contractValidationSuiteCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-contract-validation-suite");
      assert.equal(contractValidationSuiteCheckpoint?.acceptance_profile, "contract_validation_suite_gate");
      assert.equal(contractValidationSuiteCheckpoint?.status, "passed");
      assert.equal(contractValidationSuiteCheckpoint?.implementation_status, "passed");
      const identityModelCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-identity-model");
      assert.equal(identityModelCheckpoint?.acceptance_profile, "identity_model_gate");
      assert.equal(identityModelCheckpoint?.status, "passed");
      assert.equal(identityModelCheckpoint?.implementation_status, "passed");
      const clientCounterpartyRegistryCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-client-counterparty-registry");
      assert.equal(clientCounterpartyRegistryCheckpoint?.acceptance_profile, "client_counterparty_registry_gate");
      assert.equal(clientCounterpartyRegistryCheckpoint?.status, "passed");
      assert.equal(clientCounterpartyRegistryCheckpoint?.implementation_status, "passed");
      const matterProfileTeamLedgerCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-matter-profile-team-ledger");
      assert.equal(matterProfileTeamLedgerCheckpoint?.acceptance_profile, "matter_profile_team_ledger_gate");
      assert.equal(matterProfileTeamLedgerCheckpoint?.status, "passed");
      assert.equal(matterProfileTeamLedgerCheckpoint?.implementation_status, "passed");
      const wallPolicyContractCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-wall-policy-contract");
      assert.equal(wallPolicyContractCheckpoint?.acceptance_profile, "wall_policy_contract_gate");
      assert.equal(wallPolicyContractCheckpoint?.status, "passed");
      assert.equal(wallPolicyContractCheckpoint?.implementation_status, "passed");
      const matterAccessPolicyEvaluatorCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-matter-access-policy-evaluator");
      assert.equal(matterAccessPolicyEvaluatorCheckpoint?.acceptance_profile, "matter_access_policy_gate");
      assert.equal(matterAccessPolicyEvaluatorCheckpoint?.status, "passed");
      assert.equal(matterAccessPolicyEvaluatorCheckpoint?.implementation_status, "passed");
      const dataClassificationRuleEngineCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-data-classification-rule-engine");
      assert.equal(dataClassificationRuleEngineCheckpoint?.acceptance_profile, "data_classification_rule_gate");
      assert.equal(dataClassificationRuleEngineCheckpoint?.status, "passed");
      assert.equal(dataClassificationRuleEngineCheckpoint?.implementation_status, "passed");
      const matterTaggingDecisionLedgerCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-matter-tagging-decision-ledger");
      assert.equal(matterTaggingDecisionLedgerCheckpoint?.acceptance_profile, "matter_tagging_decision_gate");
      assert.equal(matterTaggingDecisionLedgerCheckpoint?.status, "passed");
      assert.equal(matterTaggingDecisionLedgerCheckpoint?.implementation_status, "passed");
      const accessAuditProjectionCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-access-audit-projection");
      assert.equal(accessAuditProjectionCheckpoint?.acceptance_profile, "access_audit_projection_gate");
      assert.equal(accessAuditProjectionCheckpoint?.status, "passed");
      assert.equal(accessAuditProjectionCheckpoint?.implementation_status, "passed");
      const storePolicyAdapterCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-store-policy-adapter");
      assert.equal(storePolicyAdapterCheckpoint?.acceptance_profile, "store_policy_adapter_gate");
      assert.equal(storePolicyAdapterCheckpoint?.status, "passed");
      assert.equal(storePolicyAdapterCheckpoint?.implementation_status, "passed");
      const conflictCheckInterfaceCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-conflict-check-interface");
      assert.equal(conflictCheckInterfaceCheckpoint?.acceptance_profile, "conflict_check_interface_gate");
      assert.equal(conflictCheckInterfaceCheckpoint?.status, "passed");
      assert.equal(conflictCheckInterfaceCheckpoint?.implementation_status, "passed");
      const personalWorkspaceBoundaryCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-personal-workspace-boundary");
      assert.equal(personalWorkspaceBoundaryCheckpoint?.acceptance_profile, "personal_workspace_boundary_gate");
      assert.equal(personalWorkspaceBoundaryCheckpoint?.status, "passed");
      assert.equal(personalWorkspaceBoundaryCheckpoint?.implementation_status, "passed");
      const policyGoldenFixturesCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-policy-golden-fixtures");
      assert.equal(policyGoldenFixturesCheckpoint?.acceptance_profile, "policy_golden_fixtures_gate");
      assert.equal(policyGoldenFixturesCheckpoint?.status, "passed");
      assert.equal(policyGoldenFixturesCheckpoint?.implementation_status, "passed_with_operational_gate");
      const policyOperationsSurfaceCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-policy-operations-surface");
      assert.equal(policyOperationsSurfaceCheckpoint?.acceptance_profile, "policy_operations_surface_gate");
      assert.equal(policyOperationsSurfaceCheckpoint?.status, "passed");
      assert.equal(policyOperationsSurfaceCheckpoint?.implementation_status, "passed_with_operational_gate");
      const matterBoundarySliceCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-matter-boundary-slice");
      assert.equal(matterBoundarySliceCheckpoint?.acceptance_profile, "matter_boundary_slice_gate");
      assert.equal(matterBoundarySliceCheckpoint?.status, "passed");
      assert.equal(matterBoundarySliceCheckpoint?.implementation_status, "passed_with_operational_gate");
      const identityPolicyMatterFreezeCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-identity-policy-matter-freeze");
      assert.equal(identityPolicyMatterFreezeCheckpoint?.acceptance_profile, "identity_policy_matter_freeze_gate");
      assert.equal(identityPolicyMatterFreezeCheckpoint?.status, "passed");
      assert.equal(identityPolicyMatterFreezeCheckpoint?.implementation_status, "passed_with_operational_gate");
      const resourceStoreInterfaceCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-resource-store-interface");
      assert.equal(resourceStoreInterfaceCheckpoint?.acceptance_profile, "resource_store_interface_gate");
      assert.equal(resourceStoreInterfaceCheckpoint?.status, "passed");
      assert.equal(resourceStoreInterfaceCheckpoint?.implementation_status, "passed_with_operational_gate");
      const immutableObjectStoreLayoutCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-immutable-object-store-layout");
      assert.equal(immutableObjectStoreLayoutCheckpoint?.acceptance_profile, "immutable_object_store_layout_gate");
      assert.equal(immutableObjectStoreLayoutCheckpoint?.status, "passed");
      assert.equal(immutableObjectStoreLayoutCheckpoint?.implementation_status, "passed_with_operational_gate");
      const resourceVersionLedgerCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-resource-version-ledger");
      assert.equal(resourceVersionLedgerCheckpoint?.acceptance_profile, "resource_version_ledger_gate");
      assert.equal(resourceVersionLedgerCheckpoint?.status, "passed");
      assert.equal(resourceVersionLedgerCheckpoint?.implementation_status, "passed_with_operational_gate");
      const normalizedTextContractCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-normalized-text-contract");
      assert.equal(normalizedTextContractCheckpoint?.acceptance_profile, "normalized_text_contract_gate");
      assert.equal(normalizedTextContractCheckpoint?.status, "passed");
      assert.equal(normalizedTextContractCheckpoint?.implementation_status, "passed_with_operational_gate");
      const extractorAdapterContractCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-extractor-adapter-contract");
      assert.equal(extractorAdapterContractCheckpoint?.acceptance_profile, "extractor_adapter_contract_gate");
      assert.equal(extractorAdapterContractCheckpoint?.status, "passed");
      assert.equal(extractorAdapterContractCheckpoint?.implementation_status, "passed_with_operational_gate");
      const sourceSpanStoreCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-source-span-store");
      assert.equal(sourceSpanStoreCheckpoint?.acceptance_profile, "source_span_store_gate");
      assert.equal(sourceSpanStoreCheckpoint?.status, "passed");
      assert.equal(sourceSpanStoreCheckpoint?.implementation_status, "passed_with_operational_gate");
      const evidenceItemStoreCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-evidence-item-store");
      assert.equal(evidenceItemStoreCheckpoint?.acceptance_profile, "evidence_item_store_gate");
      assert.equal(evidenceItemStoreCheckpoint?.status, "passed");
      assert.equal(evidenceItemStoreCheckpoint?.implementation_status, "passed_with_operational_gate");
      const factClaimStoreCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-fact-claim-store");
      assert.equal(factClaimStoreCheckpoint?.acceptance_profile, "fact_claim_store_gate");
      assert.equal(factClaimStoreCheckpoint?.status, "passed");
      assert.equal(factClaimStoreCheckpoint?.implementation_status, "passed_with_operational_gate");
      const issueGraphStoreCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-issue-graph-store");
      assert.equal(issueGraphStoreCheckpoint?.acceptance_profile, "issue_graph_store_gate");
      assert.equal(issueGraphStoreCheckpoint?.status, "passed");
      assert.equal(issueGraphStoreCheckpoint?.implementation_status, "passed_with_operational_gate");
      const citationObjectStoreCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-citation-object-store");
      assert.equal(citationObjectStoreCheckpoint?.acceptance_profile, "citation_object_store_gate");
      assert.equal(citationObjectStoreCheckpoint?.status, "passed");
      assert.equal(citationObjectStoreCheckpoint?.implementation_status, "passed_with_operational_gate");
      const lineageGraphBuilderCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-lineage-graph-builder");
      assert.equal(lineageGraphBuilderCheckpoint?.acceptance_profile, "lineage_graph_builder_gate");
      assert.equal(lineageGraphBuilderCheckpoint?.status, "passed");
      assert.equal(lineageGraphBuilderCheckpoint?.implementation_status, "passed_with_operational_gate");
      const evidenceCoverageScoreCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-evidence-coverage-score");
      assert.equal(evidenceCoverageScoreCheckpoint?.acceptance_profile, "evidence_coverage_score_gate");
      assert.equal(evidenceCoverageScoreCheckpoint?.status, "passed");
      assert.equal(evidenceCoverageScoreCheckpoint?.implementation_status, "passed_with_operational_gate");
      const evidenceFlagsCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-evidence-flags");
      assert.equal(evidenceFlagsCheckpoint?.acceptance_profile, "evidence_flags_gate");
      assert.equal(evidenceFlagsCheckpoint?.status, "passed");
      assert.equal(evidenceFlagsCheckpoint?.implementation_status, "passed_with_operational_gate");
      const exhibitMapCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-exhibit-map");
      assert.equal(exhibitMapCheckpoint?.acceptance_profile, "exhibit_map_gate");
      assert.equal(exhibitMapCheckpoint?.status, "passed");
      assert.equal(exhibitMapCheckpoint?.implementation_status, "passed_with_operational_gate");
      const chainOfCustodyCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-chain-of-custody-events");
      assert.equal(chainOfCustodyCheckpoint?.acceptance_profile, "chain_of_custody_events_gate");
      assert.equal(chainOfCustodyCheckpoint?.status, "passed");
      assert.equal(chainOfCustodyCheckpoint?.implementation_status, "passed_with_operational_gate");
      const searchIndexContractCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-search-index-contract");
      assert.equal(searchIndexContractCheckpoint?.acceptance_profile, "search_index_contract_gate");
      assert.equal(searchIndexContractCheckpoint?.status, "passed");
      assert.equal(searchIndexContractCheckpoint?.implementation_status, "passed_with_operational_gate");
      const modelPolicyEnforcementCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-model-policy-enforcement");
      assert.equal(modelPolicyEnforcementCheckpoint?.acceptance_profile, "model_policy_enforcement_gate");
      assert.equal(modelPolicyEnforcementCheckpoint?.status, "passed");
      assert.equal(modelPolicyEnforcementCheckpoint?.implementation_status, "passed");
      const toolRuntimePolicyEnforcementCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-tool-runtime-policy-enforcement");
      assert.equal(toolRuntimePolicyEnforcementCheckpoint?.acceptance_profile, "tool_runtime_policy_gate");
      assert.equal(toolRuntimePolicyEnforcementCheckpoint?.status, "passed");
      assert.equal(toolRuntimePolicyEnforcementCheckpoint?.implementation_status, "passed_with_operational_gate");
      const outputDestinationPolicyEnforcementCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-output-destination-policy-enforcement");
      assert.equal(outputDestinationPolicyEnforcementCheckpoint?.acceptance_profile, "output_destination_policy_gate");
      assert.equal(outputDestinationPolicyEnforcementCheckpoint?.status, "passed");
      assert.equal(outputDestinationPolicyEnforcementCheckpoint?.implementation_status, "passed_with_operational_gate");
      const approvalAuthorityLedgerCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-approval-authority-ledger");
      assert.equal(approvalAuthorityLedgerCheckpoint?.acceptance_profile, "approval_authority_gate");
      assert.equal(approvalAuthorityLedgerCheckpoint?.status, "passed");
      assert.equal(approvalAuthorityLedgerCheckpoint?.implementation_status, "passed_with_operational_gate");
      const policySnapshotBindingLedgerCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-policy-snapshot-bindings");
      assert.equal(policySnapshotBindingLedgerCheckpoint?.acceptance_profile, "policy_snapshot_binding_gate");
      assert.equal(policySnapshotBindingLedgerCheckpoint?.status, "passed");
      assert.equal(policySnapshotBindingLedgerCheckpoint?.implementation_status, "passed");
      const resourceContractFreezeCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-resource-contract-freeze");
      assert.equal(resourceContractFreezeCheckpoint?.acceptance_profile, "resource_contract_freeze_gate");
      assert.equal(resourceContractFreezeCheckpoint?.status, "passed");
      assert.equal(resourceContractFreezeCheckpoint?.implementation_status, "passed");
      const matterContractFreezeCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-matter-contract-freeze");
      assert.equal(matterContractFreezeCheckpoint?.acceptance_profile, "matter_contract_freeze_gate");
      assert.equal(matterContractFreezeCheckpoint?.status, "passed");
      assert.equal(matterContractFreezeCheckpoint?.implementation_status, "passed");
      const policyContractFreezeCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-policy-contract-freeze");
      assert.equal(policyContractFreezeCheckpoint?.acceptance_profile, "policy_contract_freeze_gate");
      assert.equal(policyContractFreezeCheckpoint?.status, "passed");
      assert.equal(policyContractFreezeCheckpoint?.implementation_status, "passed");
      const evidenceContractFreezeCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-evidence-contract-freeze");
      assert.equal(evidenceContractFreezeCheckpoint?.acceptance_profile, "evidence_contract_freeze_gate");
      assert.equal(evidenceContractFreezeCheckpoint?.status, "passed");
      assert.equal(evidenceContractFreezeCheckpoint?.implementation_status, "passed");
      const capabilityWorkflowContractFreezeCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-capability-workflow-contract-freeze");
      assert.equal(capabilityWorkflowContractFreezeCheckpoint?.acceptance_profile, "capability_workflow_contract_freeze_gate");
      assert.equal(capabilityWorkflowContractFreezeCheckpoint?.status, "passed");
      assert.equal(capabilityWorkflowContractFreezeCheckpoint?.implementation_status, "passed");
      const runtimeAgentRunContractFreezeCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-runtime-agentrun-contract-freeze");
      assert.equal(runtimeAgentRunContractFreezeCheckpoint?.acceptance_profile, "runtime_agentrun_contract_freeze_gate");
      assert.equal(runtimeAgentRunContractFreezeCheckpoint?.status, "passed");
      assert.equal(runtimeAgentRunContractFreezeCheckpoint?.implementation_status, "passed");
      const gateApprovalContractFreezeCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-gate-approval-contract-freeze");
      assert.equal(gateApprovalContractFreezeCheckpoint?.acceptance_profile, "gate_approval_contract_freeze_gate");
      assert.equal(gateApprovalContractFreezeCheckpoint?.status, "passed");
      assert.equal(gateApprovalContractFreezeCheckpoint?.implementation_status, "passed");
      const outputDeliveryContractFreezeCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-output-delivery-contract-freeze");
      assert.equal(outputDeliveryContractFreezeCheckpoint?.acceptance_profile, "output_delivery_contract_freeze_gate");
      assert.equal(outputDeliveryContractFreezeCheckpoint?.status, "passed");
      assert.equal(outputDeliveryContractFreezeCheckpoint?.implementation_status, "passed");
      const eventAuditRunContractFreezeCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-event-audit-run-contract-freeze");
      assert.equal(eventAuditRunContractFreezeCheckpoint?.acceptance_profile, "event_audit_run_contract_freeze_gate");
      assert.equal(eventAuditRunContractFreezeCheckpoint?.status, "passed");
      assert.equal(eventAuditRunContractFreezeCheckpoint?.implementation_status, "passed");
      const errorCostObservabilityContractFreezeCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-error-cost-observability-contract-freeze");
      assert.equal(errorCostObservabilityContractFreezeCheckpoint?.acceptance_profile, "error_cost_observability_contract_freeze_gate");
      assert.equal(errorCostObservabilityContractFreezeCheckpoint?.status, "passed");
      assert.equal(errorCostObservabilityContractFreezeCheckpoint?.implementation_status, "passed");
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
      const correctionWorkspaceCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-correction-workspace");
      assert.equal(correctionWorkspaceCheckpoint?.acceptance_profile, "human_review_correction_workspace_gate");
      assert.equal(correctionWorkspaceCheckpoint?.implementation_status, "passed_with_operational_gate");
      const correctionWorkspaceMergeCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-correction-workspace-merge");
      assert.equal(correctionWorkspaceMergeCheckpoint?.acceptance_profile, "human_review_correction_workspace_merge_gate");
      assert.equal(correctionWorkspaceMergeCheckpoint?.implementation_status, "passed_with_operational_gate");
      const correctionValidationCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-correction-validation");
      assert.equal(correctionValidationCheckpoint?.acceptance_profile, "human_review_correction_validation_gate");
      assert.equal(correctionValidationCheckpoint?.implementation_status, "passed_with_operational_gate");
      const correctionFeedbackCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-correction-feedback");
      assert.equal(correctionFeedbackCheckpoint?.acceptance_profile, "human_review_correction_feedback_gate");
      assert.equal(correctionFeedbackCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleLedgerCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-ledger");
      assert.equal(cycleLedgerCheckpoint?.acceptance_profile, "human_review_cycle_ledger_gate");
      assert.equal(cycleLedgerCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleWorkOrdersCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-work-orders");
      assert.equal(cycleWorkOrdersCheckpoint?.acceptance_profile, "human_review_cycle_work_orders_gate");
      assert.equal(cycleWorkOrdersCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleTargetAuditCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-target-audit");
      assert.equal(cycleTargetAuditCheckpoint?.acceptance_profile, "human_review_cycle_target_audit_gate");
      assert.equal(cycleTargetAuditCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleTriageInboxCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-triage-inbox");
      assert.equal(cycleTriageInboxCheckpoint?.acceptance_profile, "human_review_cycle_triage_inbox_gate");
      assert.equal(cycleTriageInboxCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReviewerConsoleCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-reviewer-console");
      assert.equal(cycleReviewerConsoleCheckpoint?.acceptance_profile, "human_review_cycle_reviewer_console_gate");
      assert.equal(cycleReviewerConsoleCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReceiptFieldAuditCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-receipt-field-audit");
      assert.equal(cycleReceiptFieldAuditCheckpoint?.acceptance_profile, "human_review_cycle_receipt_field_audit_gate");
      assert.equal(cycleReceiptFieldAuditCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReceiptCompletionPackCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-receipt-completion-pack");
      assert.equal(cycleReceiptCompletionPackCheckpoint?.acceptance_profile, "human_review_cycle_receipt_completion_pack_gate");
      assert.equal(cycleReceiptCompletionPackCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReceiptCompletionVerificationCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-receipt-completion-verification");
      assert.equal(cycleReceiptCompletionVerificationCheckpoint?.acceptance_profile, "human_review_cycle_receipt_completion_verification_gate");
      assert.equal(cycleReceiptCompletionVerificationCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReceiptCompletionWorkbenchCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-receipt-completion-workbench");
      assert.equal(cycleReceiptCompletionWorkbenchCheckpoint?.acceptance_profile, "human_review_cycle_receipt_completion_workbench_gate");
      assert.equal(cycleReceiptCompletionWorkbenchCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReceiptCompletionRunbookCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-receipt-completion-runbook");
      assert.equal(cycleReceiptCompletionRunbookCheckpoint?.acceptance_profile, "human_review_cycle_receipt_completion_runbook_gate");
      assert.equal(cycleReceiptCompletionRunbookCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReceiptCompletionReadinessCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-receipt-completion-readiness");
      assert.equal(cycleReceiptCompletionReadinessCheckpoint?.acceptance_profile, "human_review_cycle_receipt_completion_readiness_gate");
      assert.equal(cycleReceiptCompletionReadinessCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReceiptCompletionCommandQueueCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-receipt-completion-command-queue");
      assert.equal(cycleReceiptCompletionCommandQueueCheckpoint?.acceptance_profile, "human_review_cycle_receipt_completion_command_queue_gate");
      assert.equal(cycleReceiptCompletionCommandQueueCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReceiptCompletionCommandReceiptsCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-receipt-completion-command-receipts");
      assert.equal(cycleReceiptCompletionCommandReceiptsCheckpoint?.acceptance_profile, "human_review_cycle_receipt_completion_command_receipts_gate");
      assert.equal(cycleReceiptCompletionCommandReceiptsCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReceiptCompletionCommandReceiptValidationCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-receipt-completion-command-receipt-validation");
      assert.equal(cycleReceiptCompletionCommandReceiptValidationCheckpoint?.acceptance_profile, "human_review_cycle_receipt_completion_command_receipt_validation_gate");
      assert.equal(cycleReceiptCompletionCommandReceiptValidationCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReceiptCompletionCommandReceiptFeedbackCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-receipt-completion-command-receipt-feedback");
      assert.equal(cycleReceiptCompletionCommandReceiptFeedbackCheckpoint?.acceptance_profile, "human_review_cycle_receipt_completion_command_receipt_feedback_gate");
      assert.equal(cycleReceiptCompletionCommandReceiptFeedbackCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReceiptCompletionCommandReceiptWorkspaceCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-receipt-completion-command-receipt-workspace");
      assert.equal(cycleReceiptCompletionCommandReceiptWorkspaceCheckpoint?.acceptance_profile, "human_review_cycle_receipt_completion_command_receipt_workspace_gate");
      assert.equal(cycleReceiptCompletionCommandReceiptWorkspaceCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReceiptCompletionCommandReceiptWorkspaceMergeCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-receipt-completion-command-receipt-workspace-merge");
      assert.equal(cycleReceiptCompletionCommandReceiptWorkspaceMergeCheckpoint?.acceptance_profile, "human_review_cycle_receipt_completion_command_receipt_workspace_merge_gate");
      assert.equal(cycleReceiptCompletionCommandReceiptWorkspaceMergeCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReceiptCompletionCommandReceiptWorkspaceValidationCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-receipt-completion-command-receipt-workspace-validation");
      assert.equal(cycleReceiptCompletionCommandReceiptWorkspaceValidationCheckpoint?.acceptance_profile, "human_review_cycle_receipt_completion_command_receipt_workspace_validation_gate");
      assert.equal(cycleReceiptCompletionCommandReceiptWorkspaceValidationCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReceiptCompletionCommandReceiptApplicationCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-receipt-completion-command-receipt-application");
      assert.equal(cycleReceiptCompletionCommandReceiptApplicationCheckpoint?.acceptance_profile, "human_review_cycle_receipt_completion_command_receipt_application_gate");
      assert.equal(cycleReceiptCompletionCommandReceiptApplicationCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReceiptCompletionReconciliationCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-receipt-completion-reconciliation");
      assert.equal(cycleReceiptCompletionReconciliationCheckpoint?.acceptance_profile, "human_review_cycle_receipt_completion_reconciliation_gate");
      assert.equal(cycleReceiptCompletionReconciliationCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReceiptCompletionBaselineCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-receipt-completion-baseline");
      assert.equal(cycleReceiptCompletionBaselineCheckpoint?.acceptance_profile, "human_review_cycle_receipt_completion_baseline_gate");
      assert.equal(cycleReceiptCompletionBaselineCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReceiptCompletionManualCommandReceiptPackCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-receipt-completion-manual-command-receipt-pack");
      assert.equal(cycleReceiptCompletionManualCommandReceiptPackCheckpoint?.acceptance_profile, "human_review_cycle_receipt_completion_manual_command_receipt_pack_gate");
      assert.equal(cycleReceiptCompletionManualCommandReceiptPackCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReceiptCompletionHeldCommandResolutionCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-receipt-completion-held-command-resolution");
      assert.equal(cycleReceiptCompletionHeldCommandResolutionCheckpoint?.acceptance_profile, "human_review_cycle_receipt_completion_held_command_resolution_gate");
      assert.equal(cycleReceiptCompletionHeldCommandResolutionCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReceiptCompletionProtectedApprovalRequestPackCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-receipt-completion-protected-approval-request-pack");
      assert.equal(cycleReceiptCompletionProtectedApprovalRequestPackCheckpoint?.acceptance_profile, "human_review_cycle_receipt_completion_protected_approval_request_pack_gate");
      assert.equal(cycleReceiptCompletionProtectedApprovalRequestPackCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReceiptCompletionManualRevalidationCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-receipt-completion-manual-revalidation");
      assert.equal(cycleReceiptCompletionManualRevalidationCheckpoint?.acceptance_profile, "human_review_cycle_receipt_completion_manual_revalidation_gate");
      assert.equal(cycleReceiptCompletionManualRevalidationCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReceiptCompletionCommandQueuePatchProjectionCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-receipt-completion-command-queue-patch-projection");
      assert.equal(cycleReceiptCompletionCommandQueuePatchProjectionCheckpoint?.acceptance_profile, "human_review_cycle_receipt_completion_command_queue_patch_projection_gate");
      assert.equal(cycleReceiptCompletionCommandQueuePatchProjectionCheckpoint?.implementation_status, "passed_with_operational_gate");
      const cycleReceiptCompletionCloseoutLedgerCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-cycle-receipt-completion-closeout-ledger");
      assert.equal(cycleReceiptCompletionCloseoutLedgerCheckpoint?.acceptance_profile, "human_review_cycle_receipt_completion_closeout_ledger_gate");
      assert.equal(cycleReceiptCompletionCloseoutLedgerCheckpoint?.implementation_status, "passed_with_operational_gate");
      const humanReviewV1RegressionFreezeCheckpoint = controlPlaneGoalCheckpoint.checkpoint_items.find((item) => item.checkpoint_item_id === "control-plane-human-review-v1-regression-freeze");
      assert.equal(humanReviewV1RegressionFreezeCheckpoint?.acceptance_profile, "human_review_v1_regression_freeze_gate");
      assert.equal(humanReviewV1RegressionFreezeCheckpoint?.implementation_status, "passed_with_operational_gate");
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
      assert.equal(dashboard.summary.policy_snapshot_binding_status, "complete");
      assert.equal(dashboard.summary.policy_snapshot_binding_count, policySnapshotBindingLedger.summary.policy_snapshot_binding_count);
      assert.equal(dashboard.summary.policy_snapshot_binding_known_count, policySnapshotBindingLedger.summary.known_policy_snapshot_binding_count);
      assert.equal(dashboard.summary.policy_snapshot_binding_workflow_count, policySnapshotBindingLedger.summary.workflow_policy_binding_count);
      assert.equal(dashboard.summary.policy_snapshot_binding_agent_run_count, policySnapshotBindingLedger.summary.agent_run_policy_binding_count);
      assert.equal(dashboard.summary.policy_snapshot_binding_event_count, policySnapshotBindingLedger.summary.event_policy_binding_count);
      assert.equal(dashboard.summary.policy_snapshot_binding_gate_count, policySnapshotBindingLedger.summary.gate_policy_binding_count);
      assert.equal(dashboard.summary.policy_snapshot_binding_approval_count, policySnapshotBindingLedger.summary.approval_policy_binding_count);
      assert.equal(dashboard.summary.policy_snapshot_binding_output_count, policySnapshotBindingLedger.summary.output_policy_binding_count);
      assert.equal(dashboard.summary.policy_snapshot_binding_fallback_count, policySnapshotBindingLedger.summary.fallback_resolved_binding_count);
      assert.equal(dashboard.summary.policy_snapshot_binding_missing_count, 0);
      assert.equal(dashboard.summary.policy_snapshot_binding_unresolved_count, 0);
      assert.equal(dashboard.summary.policy_snapshot_binding_validation_error_count, 0);
      assert.equal(dashboard.summary.context_packet_count, contextPacketLedger.summary.context_packet_count);
      assert.equal(dashboard.summary.context_packet_ready_count, contextPacketLedger.summary.ready_packet_count);
      assert.equal(dashboard.summary.context_packet_redacted_count, contextPacketLedger.summary.redacted_packet_count);
      assert.equal(dashboard.summary.context_item_count, contextPacketLedger.summary.context_item_count);
      assert.equal(dashboard.summary.context_retrieval_filter_count, contextPacketLedger.summary.retrieval_filter_count);
      assert.equal(dashboard.summary.model_route_count, modelRoutingLedger.summary.routing_decision_count);
      assert.equal(dashboard.summary.model_route_ready_count, modelRoutingLedger.summary.ready_route_count);
      assert.equal(dashboard.summary.model_route_external_transfer_count, modelRoutingLedger.summary.external_transfer_count);
      assert.equal(dashboard.summary.model_route_validation_error_count, 0);
      assert.equal(dashboard.summary.model_policy_enforcement_status, "complete");
      assert.equal(dashboard.summary.model_policy_classification_gate_count, modelPolicyEnforcement.summary.classification_model_gate_count);
      assert.equal(dashboard.summary.model_policy_resource_gate_count, modelPolicyEnforcement.summary.resource_model_gate_count);
      assert.equal(dashboard.summary.model_policy_route_gate_count, modelPolicyEnforcement.summary.route_model_gate_count);
      assert.equal(dashboard.summary.model_policy_p2_p5_classification_gate_count, modelPolicyEnforcement.summary.p2_p5_classification_gate_count);
      assert.equal(dashboard.summary.model_policy_p2_p5_resource_gate_count, modelPolicyEnforcement.summary.p2_p5_resource_gate_count);
      assert.equal(dashboard.summary.model_policy_external_transfer_route_count, modelPolicyEnforcement.summary.external_transfer_route_count);
      assert.equal(dashboard.summary.model_policy_p2_p5_external_transfer_route_count, 0);
      assert.equal(dashboard.summary.model_policy_external_transfer_allowed_count, modelPolicyEnforcement.summary.external_transfer_allowed_count);
      assert.equal(dashboard.summary.model_policy_unauthorized_external_allow_count, 0);
      assert.equal(dashboard.summary.model_policy_validation_error_count, 0);
      assert.equal(dashboard.summary.tool_runtime_policy_enforcement_status, "complete");
      assert.equal(dashboard.summary.tool_runtime_policy_runtime_gate_count, toolRuntimePolicyEnforcement.summary.runtime_policy_gate_count);
      assert.equal(dashboard.summary.tool_runtime_policy_tool_gate_count, toolRuntimePolicyEnforcement.summary.tool_permission_gate_count);
      assert.equal(dashboard.summary.tool_runtime_policy_forbidden_tool_blocked_count, toolRuntimePolicyEnforcement.summary.forbidden_tool_blocked_count);
      assert.equal(dashboard.summary.tool_runtime_policy_agent_run_gate_count, toolRuntimePolicyEnforcement.summary.agent_run_tool_gate_count);
      assert.equal(dashboard.summary.tool_runtime_policy_unknown_tool_count, 0);
      assert.equal(dashboard.summary.tool_runtime_policy_tool_overlap_count, 0);
      assert.equal(dashboard.summary.tool_runtime_policy_missing_gate_count, 0);
      assert.equal(dashboard.summary.tool_runtime_policy_validation_error_count, 0);
      assert.equal(dashboard.summary.output_destination_policy_status, "complete");
      assert.equal(dashboard.summary.output_destination_policy_rule_count, outputDestinationPolicyEnforcement.summary.policy_rule_count);
      assert.equal(dashboard.summary.output_destination_policy_artifact_gate_count, outputDestinationPolicyEnforcement.summary.artifact_destination_gate_count);
      assert.equal(dashboard.summary.output_destination_policy_delivery_action_gate_count, outputDestinationPolicyEnforcement.summary.delivery_action_destination_gate_count);
      assert.equal(dashboard.summary.output_destination_policy_final_action_gate_count, outputDestinationPolicyEnforcement.summary.final_action_separation_gate_count);
      assert.equal(dashboard.summary.output_destination_policy_required_delivery_count, outputDestinationPolicyEnforcement.summary.final_action_required_delivery_count);
      assert.equal(dashboard.summary.output_destination_policy_protected_destination_count, outputDestinationPolicyEnforcement.summary.protected_destination_count);
      assert.equal(dashboard.summary.output_destination_policy_blocked_final_action_count, outputDestinationPolicyEnforcement.summary.blocked_final_action_count);
      assert.equal(dashboard.summary.output_destination_policy_unsafe_final_action_count, 0);
      assert.equal(dashboard.summary.output_destination_policy_missing_policy_count, 0);
      assert.equal(dashboard.summary.output_destination_policy_missing_tool_policy_count, 0);
      assert.equal(dashboard.summary.output_destination_policy_missing_gate_count, 0);
      assert.equal(dashboard.summary.output_destination_policy_validation_error_count, 0);
      assert.equal(dashboard.summary.approval_authority_status, "complete");
      assert.equal(dashboard.summary.approval_authority_policy_count, approvalAuthorityLedger.summary.authority_policy_count);
      assert.equal(dashboard.summary.approval_authority_decision_count, approvalAuthorityLedger.summary.authority_decision_count);
      assert.equal(dashboard.summary.approval_authority_artifact_decision_count, approvalAuthorityLedger.summary.artifact_authority_decision_count);
      assert.equal(dashboard.summary.approval_authority_request_decision_count, approvalAuthorityLedger.summary.approval_request_authority_decision_count);
      assert.equal(dashboard.summary.approval_authority_delivery_action_decision_count, approvalAuthorityLedger.summary.delivery_action_authority_decision_count);
      assert.equal(dashboard.summary.approval_authority_assigned_decision_count, approvalAuthorityLedger.summary.assigned_authority_decision_count);
      assert.equal(dashboard.summary.approval_authority_assignment_required_count, approvalAuthorityLedger.summary.assignment_required_decision_count);
      assert.equal(dashboard.summary.approval_authority_law_firm_human_required_count, approvalAuthorityLedger.summary.law_firm_human_required_decision_count);
      assert.equal(dashboard.summary.approval_authority_nonhuman_blocked_count, approvalAuthorityLedger.summary.nonhuman_authority_blocked_count);
      assert.equal(dashboard.summary.approval_authority_missing_role_count, 0);
      assert.equal(dashboard.summary.approval_authority_validation_error_count, 0);
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
      assert.equal(dashboard.summary.contract_inventory_schema_count, contractInventory.summary.schema_count);
      assert.equal(dashboard.summary.contract_inventory_parsed_schema_count, contractInventory.summary.parsed_schema_count);
      assert.equal(dashboard.summary.contract_inventory_package_script_count, contractInventory.summary.package_script_count);
      assert.equal(dashboard.summary.contract_inventory_loop_output_contract_count, contractInventory.summary.loop_output_contract_count);
      assert.equal(dashboard.summary.contract_inventory_dashboard_source_count, contractInventory.summary.dashboard_source_count);
      assert.equal(dashboard.summary.contract_inventory_api_route_count, contractInventory.summary.api_route_count);
      assert.equal(dashboard.summary.contract_inventory_artifact_contract_count, contractInventory.summary.artifact_contract_count);
      assert.equal(dashboard.summary.contract_inventory_owner_mapped_item_count, contractInventory.summary.owner_mapped_item_count);
      assert.equal(dashboard.summary.contract_inventory_owner_area_count, contractInventory.summary.owner_area_count);
      assert.equal(dashboard.summary.contract_inventory_validation_error_count, 0);
      assert.equal(dashboard.summary.contract_dependency_map_node_count, contractDependencyMap.summary.node_count);
      assert.equal(dashboard.summary.contract_dependency_map_edge_count, contractDependencyMap.summary.edge_count);
      assert.equal(dashboard.summary.contract_dependency_map_schema_edge_count, contractDependencyMap.summary.schema_dependency_edge_count);
      assert.equal(dashboard.summary.contract_dependency_map_dashboard_edge_count, contractDependencyMap.summary.dashboard_dependency_edge_count);
      assert.equal(dashboard.summary.contract_dependency_map_api_edge_count, contractDependencyMap.summary.api_dependency_edge_count);
      assert.equal(dashboard.summary.contract_dependency_map_owner_dependency_count, contractDependencyMap.summary.owner_dependency_count);
      assert.equal(dashboard.summary.contract_dependency_map_risk_count, contractDependencyMap.summary.breaking_change_risk_count);
      assert.equal(dashboard.summary.contract_dependency_map_high_risk_count, 0);
      assert.equal(dashboard.summary.contract_dependency_map_direction_violation_count, 0);
      assert.equal(dashboard.summary.contract_dependency_map_validation_error_count, 0);
      assert.equal(dashboard.summary.schema_versioning_guideline_status, "complete");
      assert.equal(dashboard.summary.schema_versioning_schema_count, schemaVersioningRules.summary.schema_count);
      assert.equal(dashboard.summary.schema_versioning_versioned_schema_count, schemaVersioningRules.summary.versioned_schema_count);
      assert.equal(dashboard.summary.schema_versioning_legacy_exception_count, schemaVersioningRules.summary.legacy_exception_count);
      assert.equal(dashboard.summary.schema_versioning_non_compliant_schema_count, 0);
      assert.equal(dashboard.summary.schema_versioning_optional_addition_compatible_count, schemaVersioningRules.summary.optional_addition_compatible_count);
      assert.equal(dashboard.summary.schema_versioning_closed_world_schema_count, 0);
      assert.equal(dashboard.summary.schema_versioning_deprecated_field_count, schemaVersioningRules.summary.deprecated_field_count);
      assert.equal(dashboard.summary.schema_versioning_migration_manifest_rule_count, 1);
      assert.equal(dashboard.summary.schema_versioning_deprecation_rule_count, 1);
      assert.equal(dashboard.summary.schema_versioning_optional_addition_rule_count, 1);
      assert.equal(dashboard.summary.schema_versioning_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.schema_versioning_validation_error_count, 0);
      assert.equal(dashboard.summary.schema_migration_manifest_status, "complete");
      assert.equal(dashboard.summary.schema_migration_manifest_count, schemaMigrationManifest.summary.manifest_count);
      assert.equal(dashboard.summary.schema_migration_core_count, 1);
      assert.equal(dashboard.summary.schema_migration_pack_count, 1);
      assert.equal(dashboard.summary.schema_migration_index_count, 1);
      assert.equal(dashboard.summary.schema_migration_record_count, schemaMigrationManifest.summary.migration_record_count);
      assert.equal(dashboard.summary.schema_migration_declared_manifest_count, schemaMigrationManifest.summary.declared_manifest_count);
      assert.equal(dashboard.summary.schema_migration_planned_record_count, schemaMigrationManifest.summary.planned_record_count);
      assert.equal(dashboard.summary.schema_migration_not_run_dry_run_record_count, schemaMigrationManifest.summary.not_run_dry_run_record_count);
      assert.equal(dashboard.summary.schema_migration_data_step_count, schemaMigrationManifest.summary.data_migration_step_count);
      assert.equal(dashboard.summary.schema_migration_index_step_count, schemaMigrationManifest.summary.index_migration_step_count);
      assert.equal(dashboard.summary.schema_migration_dry_run_command_count, schemaMigrationManifest.summary.dry_run_command_count);
      assert.equal(dashboard.summary.schema_migration_rollback_note_count, schemaMigrationManifest.summary.rollback_note_count);
      assert.equal(dashboard.summary.schema_migration_validation_command_count, schemaMigrationManifest.summary.validation_command_count);
      assert.equal(dashboard.summary.schema_migration_legacy_exception_covered_count, schemaMigrationManifest.summary.legacy_exception_covered_count);
      assert.equal(dashboard.summary.schema_migration_missing_legacy_exception_count, 0);
      assert.equal(dashboard.summary.schema_migration_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.schema_migration_validation_error_count, 0);
      assert.equal(dashboard.summary.contract_golden_fixture_status, "complete");
      assert.equal(dashboard.summary.contract_golden_fixture_count, contractGoldenFixtures.summary.fixture_count);
      assert.equal(dashboard.summary.contract_golden_required_fixture_count, contractGoldenFixtures.summary.required_fixture_count);
      assert.equal(dashboard.summary.contract_golden_locked_fixture_count, contractGoldenFixtures.summary.locked_fixture_count);
      assert.equal(dashboard.summary.contract_golden_blocked_fixture_count, 0);
      assert.equal(dashboard.summary.contract_golden_schema_valid_fixture_count, contractGoldenFixtures.summary.schema_valid_fixture_count);
      assert.equal(dashboard.summary.contract_golden_schema_invalid_fixture_count, 0);
      assert.equal(dashboard.summary.contract_golden_regression_hash_count, contractGoldenFixtures.summary.regression_hash_count);
      assert.equal(dashboard.summary.contract_golden_locked_regression_hash_count, contractGoldenFixtures.summary.locked_regression_hash_count);
      assert.equal(dashboard.summary.contract_golden_missing_artifact_count, 0);
      assert.equal(dashboard.summary.contract_golden_schema_version_present_count, contractGoldenFixtures.summary.schema_version_present_count);
      assert.equal(dashboard.summary.contract_golden_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.contract_golden_validation_error_count, 0);
      assert.equal(dashboard.summary.contract_validation_suite_status, "complete");
      assert.equal(dashboard.summary.contract_validation_fixture_count, contractValidationSuite.summary.fixture_count);
      assert.equal(dashboard.summary.contract_validation_validated_fixture_count, contractValidationSuite.summary.validated_fixture_count);
      assert.equal(dashboard.summary.contract_validation_schema_valid_fixture_count, contractValidationSuite.summary.schema_valid_fixture_count);
      assert.equal(dashboard.summary.contract_validation_schema_invalid_fixture_count, 0);
      assert.equal(dashboard.summary.contract_validation_regression_passed_count, contractValidationSuite.summary.regression_passed_count);
      assert.equal(dashboard.summary.contract_validation_regression_failed_count, 0);
      assert.equal(dashboard.summary.contract_validation_content_hash_match_count, contractValidationSuite.summary.content_hash_match_count);
      assert.equal(dashboard.summary.contract_validation_content_hash_mismatch_count, 0);
      assert.equal(dashboard.summary.contract_validation_schema_hash_match_count, contractValidationSuite.summary.schema_hash_match_count);
      assert.equal(dashboard.summary.contract_validation_schema_hash_mismatch_count, 0);
      assert.equal(dashboard.summary.contract_validation_required_package_script_count, contractValidationSuite.summary.required_package_script_count);
      assert.equal(dashboard.summary.contract_validation_present_package_script_count, contractValidationSuite.summary.present_package_script_count);
      assert.equal(dashboard.summary.contract_validation_missing_package_script_count, 0);
      assert.equal(dashboard.summary.contract_validation_roadmap_declared_count, contractValidationSuite.summary.roadmap_declared_count);
      assert.equal(dashboard.summary.contract_validation_roadmap_missing_count, 0);
      assert.equal(dashboard.summary.contract_validation_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.contract_validation_validation_error_count, 0);
      assert.equal(dashboard.summary.identity_model_status, "complete");
      assert.equal(dashboard.summary.identity_model_tenant_count, identityModel.summary.tenant_count);
      assert.equal(dashboard.summary.identity_model_user_count, identityModel.summary.user_count);
      assert.equal(dashboard.summary.identity_model_role_count, identityModel.summary.role_count);
      assert.equal(dashboard.summary.identity_model_role_assignment_count, identityModel.summary.role_assignment_count);
      assert.equal(dashboard.summary.identity_model_actor_principal_count, identityModel.summary.actor_principal_count);
      assert.equal(dashboard.summary.identity_model_human_actor_principal_count, identityModel.summary.human_actor_principal_count);
      assert.equal(dashboard.summary.identity_model_service_actor_principal_count, identityModel.summary.service_actor_principal_count);
      assert.equal(dashboard.summary.identity_model_actor_user_binding_count, identityModel.summary.actor_user_binding_count);
      assert.equal(dashboard.summary.identity_model_human_actor_user_binding_count, identityModel.summary.human_actor_user_binding_count);
      assert.equal(dashboard.summary.identity_model_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.identity_model_validation_error_count, 0);
      assert.equal(dashboard.summary.resource_contract_freeze_resource_count, resourceContractFreeze.summary.resource_count);
      assert.equal(dashboard.summary.resource_contract_freeze_resource_version_count, resourceContractFreeze.summary.resource_version_count);
      assert.equal(dashboard.summary.resource_contract_freeze_content_hash_count, resourceContractFreeze.summary.content_hash_count);
      assert.equal(dashboard.summary.resource_contract_freeze_source_system_count, resourceContractFreeze.summary.source_system_count);
      assert.equal(dashboard.summary.resource_contract_freeze_external_id_count, resourceContractFreeze.summary.external_id_count);
      assert.equal(dashboard.summary.resource_contract_freeze_classification_count, resourceContractFreeze.summary.classification_count);
      assert.equal(dashboard.summary.resource_contract_freeze_matter_link_count, resourceContractFreeze.summary.matter_link_count);
      assert.equal(dashboard.summary.resource_contract_freeze_latest_version_link_count, resourceContractFreeze.summary.latest_version_link_count);
      assert.equal(dashboard.summary.resource_contract_freeze_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.resource_contract_freeze_validation_error_count, 0);
      assert.equal(dashboard.summary.matter_contract_freeze_client_count, matterContractFreeze.summary.client_count);
      assert.equal(dashboard.summary.matter_contract_freeze_party_count, matterContractFreeze.summary.party_count);
      assert.equal(dashboard.summary.matter_contract_freeze_client_party_count, matterContractFreeze.summary.client_party_count);
      assert.equal(dashboard.summary.matter_contract_freeze_counterparty_count, matterContractFreeze.summary.counterparty_count);
      assert.equal(dashboard.summary.matter_contract_freeze_matter_count, matterContractFreeze.summary.matter_count);
      assert.equal(dashboard.summary.matter_contract_freeze_matter_team_count, matterContractFreeze.summary.matter_team_count);
      assert.equal(dashboard.summary.matter_contract_freeze_matter_boundary_count, matterContractFreeze.summary.matter_boundary_count);
      assert.equal(dashboard.summary.matter_contract_freeze_matter_with_client_count, matterContractFreeze.summary.matter_with_client_count);
      assert.equal(dashboard.summary.matter_contract_freeze_matter_with_party_count, matterContractFreeze.summary.matter_with_party_count);
      assert.equal(dashboard.summary.matter_contract_freeze_matter_with_counterparty_count, matterContractFreeze.summary.matter_with_counterparty_count);
      assert.equal(dashboard.summary.matter_contract_freeze_matter_with_team_count, matterContractFreeze.summary.matter_with_team_count);
      assert.equal(dashboard.summary.matter_contract_freeze_matter_with_wall_count, matterContractFreeze.summary.matter_with_wall_count);
      assert.equal(dashboard.summary.matter_contract_freeze_matter_with_policy_snapshot_count, matterContractFreeze.summary.matter_with_policy_snapshot_count);
      assert.equal(dashboard.summary.matter_contract_freeze_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.matter_contract_freeze_validation_error_count, 0);
      assert.equal(dashboard.summary.client_counterparty_registry_status, "complete");
      assert.equal(dashboard.summary.client_counterparty_party_count, clientCounterpartyRegistry.summary.party_count);
      assert.equal(dashboard.summary.client_counterparty_client_count, clientCounterpartyRegistry.summary.client_count);
      assert.equal(dashboard.summary.client_counterparty_counterparty_count, clientCounterpartyRegistry.summary.counterparty_count);
      assert.equal(dashboard.summary.client_counterparty_stable_party_id_count, clientCounterpartyRegistry.summary.stable_party_id_count);
      assert.equal(dashboard.summary.client_counterparty_alias_key_count, clientCounterpartyRegistry.summary.alias_key_count);
      assert.equal(dashboard.summary.client_counterparty_conflict_reference_count, clientCounterpartyRegistry.summary.conflict_reference_count);
      assert.equal(dashboard.summary.client_counterparty_matter_party_link_count, clientCounterpartyRegistry.summary.matter_party_link_count);
      assert.equal(dashboard.summary.client_counterparty_matter_with_client_link_count, clientCounterpartyRegistry.summary.matter_with_client_link_count);
      assert.equal(dashboard.summary.client_counterparty_matter_with_counterparty_link_count, clientCounterpartyRegistry.summary.matter_with_counterparty_link_count);
      assert.equal(dashboard.summary.client_counterparty_duplicate_alias_count, 0);
      assert.equal(dashboard.summary.client_counterparty_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.client_counterparty_validation_error_count, 0);
      assert.equal(dashboard.summary.matter_profile_team_ledger_status, "complete");
      assert.equal(dashboard.summary.matter_profile_team_matter_profile_count, matterProfileTeamLedger.summary.matter_profile_count);
      assert.equal(dashboard.summary.matter_profile_team_roster_count, matterProfileTeamLedger.summary.matter_team_roster_count);
      assert.equal(dashboard.summary.matter_profile_team_membership_count, matterProfileTeamLedger.summary.team_membership_count);
      assert.equal(dashboard.summary.matter_profile_team_active_membership_count, matterProfileTeamLedger.summary.active_team_membership_count);
      assert.equal(dashboard.summary.matter_profile_team_access_subject_count, matterProfileTeamLedger.summary.matter_access_subject_count);
      assert.equal(dashboard.summary.matter_profile_team_allowed_access_subject_count, matterProfileTeamLedger.summary.allowed_access_subject_count);
      assert.equal(dashboard.summary.matter_profile_team_denied_access_subject_count, matterProfileTeamLedger.summary.denied_access_subject_count);
      assert.equal(dashboard.summary.matter_profile_team_matter_with_team_count, matterProfileTeamLedger.summary.matter_with_team_count);
      assert.equal(dashboard.summary.matter_profile_team_matter_with_responsible_partner_count, matterProfileTeamLedger.summary.matter_with_responsible_partner_count);
      assert.equal(dashboard.summary.matter_profile_team_team_member_user_count, matterProfileTeamLedger.summary.team_member_user_count);
      assert.equal(dashboard.summary.matter_profile_team_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.matter_profile_team_validation_error_count, 0);
      assert.equal(dashboard.summary.wall_policy_contract_status, "complete");
      assert.equal(dashboard.summary.wall_policy_rule_count, wallPolicyContract.summary.wall_policy_rule_count);
      assert.equal(dashboard.summary.wall_policy_active_rule_count, wallPolicyContract.summary.active_wall_policy_rule_count);
      assert.equal(dashboard.summary.wall_policy_pre_retrieval_rule_count, wallPolicyContract.summary.pre_retrieval_rule_count);
      assert.equal(dashboard.summary.wall_policy_deny_unless_allowed_rule_count, wallPolicyContract.summary.deny_unless_allowed_rule_count);
      assert.equal(dashboard.summary.wall_policy_retrieval_filter_count, wallPolicyContract.summary.retrieval_wall_filter_count);
      assert.equal(dashboard.summary.wall_policy_complete_retrieval_filter_count, wallPolicyContract.summary.complete_retrieval_wall_filter_count);
      assert.equal(dashboard.summary.wall_policy_subject_binding_count, wallPolicyContract.summary.wall_subject_binding_count);
      assert.equal(dashboard.summary.wall_policy_allowed_subject_binding_count, wallPolicyContract.summary.allowed_wall_subject_binding_count);
      assert.equal(dashboard.summary.wall_policy_conflict_binding_count, wallPolicyContract.summary.conflict_wall_binding_count);
      assert.equal(dashboard.summary.wall_policy_ready_conflict_binding_count, wallPolicyContract.summary.ready_conflict_wall_binding_count);
      assert.equal(dashboard.summary.wall_policy_required_filter_key_count, wallPolicyContract.summary.required_filter_key_count);
      assert.equal(dashboard.summary.wall_policy_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.wall_policy_validation_error_count, 0);
      assert.equal(dashboard.summary.matter_access_policy_status, "complete");
      assert.equal(dashboard.summary.matter_access_policy_rule_count, matterAccessPolicyEvaluator.summary.access_policy_rule_count);
      assert.equal(dashboard.summary.matter_access_decision_count, matterAccessPolicyEvaluator.summary.matter_access_decision_count);
      assert.equal(dashboard.summary.matter_access_resource_decision_count, matterAccessPolicyEvaluator.summary.resource_access_decision_count);
      assert.equal(dashboard.summary.matter_access_runtime_matrix_count, matterAccessPolicyEvaluator.summary.runtime_access_matrix_count);
      assert.equal(dashboard.summary.matter_access_allow_decision_count, matterAccessPolicyEvaluator.summary.allow_decision_count);
      assert.equal(dashboard.summary.matter_access_review_decision_count, matterAccessPolicyEvaluator.summary.review_decision_count);
      assert.equal(dashboard.summary.matter_access_deny_decision_count, matterAccessPolicyEvaluator.summary.deny_decision_count);
      assert.equal(dashboard.summary.matter_access_unassigned_resource_review_count, matterAccessPolicyEvaluator.summary.unassigned_resource_review_count);
      assert.equal(dashboard.summary.matter_access_runtime_count, matterAccessPolicyEvaluator.summary.runtime_count);
      assert.equal(dashboard.summary.matter_access_resource_count, matterAccessPolicyEvaluator.summary.resource_count);
      assert.equal(dashboard.summary.matter_access_subject_count, matterAccessPolicyEvaluator.summary.access_subject_count);
      assert.equal(dashboard.summary.matter_access_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.matter_access_validation_error_count, 0);
      assert.equal(dashboard.summary.policy_contract_freeze_classification_count, policyContractFreeze.summary.classification_count);
      assert.equal(dashboard.summary.policy_contract_freeze_required_classification_count, policyContractFreeze.summary.required_classification_count);
      assert.equal(dashboard.summary.policy_contract_freeze_missing_classification_count, 0);
      assert.equal(dashboard.summary.policy_contract_freeze_extra_classification_count, 0);
      assert.equal(dashboard.summary.policy_contract_freeze_runtime_rule_link_count, policyContractFreeze.summary.runtime_rule_link_count);
      assert.equal(dashboard.summary.policy_contract_freeze_model_rule_link_count, policyContractFreeze.summary.model_rule_link_count);
      assert.equal(dashboard.summary.policy_contract_freeze_policy_decision_count, policyContractFreeze.summary.policy_decision_count);
      assert.equal(dashboard.summary.policy_contract_freeze_policy_reference_count, policyContractFreeze.summary.policy_reference_count);
      assert.equal(dashboard.summary.policy_contract_freeze_resolved_policy_reference_count, policyContractFreeze.summary.resolved_policy_reference_count);
      assert.equal(dashboard.summary.policy_contract_freeze_unresolved_policy_reference_count, 0);
      assert.equal(dashboard.summary.policy_contract_freeze_resource_policy_reference_count, policyContractFreeze.summary.resource_policy_reference_count);
      assert.equal(dashboard.summary.policy_contract_freeze_matter_policy_reference_count, policyContractFreeze.summary.matter_policy_reference_count);
      assert.equal(dashboard.summary.policy_contract_freeze_matter_boundary_policy_reference_count, policyContractFreeze.summary.matter_boundary_policy_reference_count);
      assert.equal(dashboard.summary.policy_contract_freeze_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.policy_contract_freeze_validation_error_count, 0);
      assert.equal(dashboard.summary.data_classification_rule_engine_status, "complete");
      assert.equal(dashboard.summary.data_classification_rule_source_resource_contract_status, "complete");
      assert.equal(dashboard.summary.data_classification_rule_source_policy_contract_status, "complete");
      assert.equal(dashboard.summary.data_classification_rule_source_matter_access_policy_status, "complete");
      assert.equal(dashboard.summary.data_classification_rule_count, dataClassificationRuleEngine.summary.classification_rule_count);
      assert.equal(dashboard.summary.data_classification_rule_resource_decision_count, dataClassificationRuleEngine.summary.resource_classification_decision_count);
      assert.equal(dashboard.summary.data_classification_rule_policy_binding_count, dataClassificationRuleEngine.summary.classification_policy_binding_count);
      assert.equal(dashboard.summary.data_classification_rule_policy_bound_resource_count, dataClassificationRuleEngine.summary.policy_bound_resource_count);
      assert.equal(dashboard.summary.data_classification_rule_unbound_resource_count, 0);
      assert.equal(dashboard.summary.data_classification_rule_review_decision_count, dataClassificationRuleEngine.summary.review_decision_count);
      assert.equal(dashboard.summary.data_classification_rule_external_model_review_count, dataClassificationRuleEngine.summary.external_model_review_count);
      assert.equal(dashboard.summary.data_classification_rule_matter_tagging_review_count, dataClassificationRuleEngine.summary.matter_tagging_review_count);
      assert.equal(dashboard.summary.data_classification_rule_matter_access_link_count, dataClassificationRuleEngine.summary.matter_access_link_count);
      assert.equal(dashboard.summary.data_classification_rule_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.data_classification_rule_validation_error_count, 0);
      assert.equal(dashboard.summary.matter_tagging_ledger_status, "complete");
      assert.equal(dashboard.summary.matter_tagging_source_resource_contract_status, "complete");
      assert.equal(dashboard.summary.matter_tagging_source_matter_profile_team_ledger_status, "complete");
      assert.equal(dashboard.summary.matter_tagging_source_matter_access_policy_status, "complete");
      assert.equal(dashboard.summary.matter_tagging_source_data_classification_rule_engine_status, "complete");
      assert.equal(dashboard.summary.matter_tagging_resource_count, matterTaggingDecisionLedger.summary.resource_count);
      assert.equal(dashboard.summary.matter_tagging_decision_count, matterTaggingDecisionLedger.summary.matter_tagging_decision_count);
      assert.equal(dashboard.summary.matter_tagging_automatic_candidate_count, matterTaggingDecisionLedger.summary.automatic_candidate_count);
      assert.equal(dashboard.summary.matter_tagging_pending_confirmation_count, matterTaggingDecisionLedger.summary.pending_human_confirmation_count);
      assert.equal(dashboard.summary.matter_tagging_confirmation_request_count, matterTaggingDecisionLedger.summary.human_confirmation_request_count);
      assert.equal(dashboard.summary.matter_tagging_correction_history_count, 0);
      assert.equal(dashboard.summary.matter_tagging_auto_applied_count, 0);
      assert.equal(dashboard.summary.matter_tagging_no_candidate_count, 0);
      assert.equal(dashboard.summary.matter_tagging_tenant_boundary_mismatch_count, matterTaggingDecisionLedger.summary.tenant_boundary_mismatch_count);
      assert.equal(dashboard.summary.matter_tagging_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.matter_tagging_validation_error_count, 0);
      assert.equal(dashboard.summary.access_audit_projection_status, "complete");
      assert.equal(dashboard.summary.access_audit_source_matter_access_policy_status, "complete");
      assert.equal(dashboard.summary.access_audit_source_matter_tagging_ledger_status, "complete");
      assert.equal(dashboard.summary.access_audit_record_count, accessAuditProjection.summary.access_audit_record_count);
      assert.equal(dashboard.summary.access_audit_matter_record_count, accessAuditProjection.summary.matter_audit_record_count);
      assert.equal(dashboard.summary.access_audit_resource_record_count, accessAuditProjection.summary.resource_audit_record_count);
      assert.equal(dashboard.summary.access_audit_actor_rollup_count, accessAuditProjection.summary.actor_access_rollup_count);
      assert.equal(dashboard.summary.access_audit_resource_rollup_count, accessAuditProjection.summary.resource_access_rollup_count);
      assert.equal(dashboard.summary.access_audit_view_allowed_count, accessAuditProjection.summary.view_allowed_count);
      assert.equal(dashboard.summary.access_audit_view_requires_human_confirmation_count, accessAuditProjection.summary.view_requires_human_confirmation_count);
      assert.equal(dashboard.summary.access_audit_view_denied_count, accessAuditProjection.summary.view_denied_count);
      assert.equal(dashboard.summary.access_audit_can_retrieve_count, accessAuditProjection.summary.can_retrieve_count);
      assert.equal(dashboard.summary.access_audit_human_review_required_count, accessAuditProjection.summary.human_review_required_count);
      assert.equal(dashboard.summary.access_audit_matter_tagging_linked_count, accessAuditProjection.summary.matter_tagging_linked_count);
      assert.equal(dashboard.summary.access_audit_matter_tagging_unresolved_count, 0);
      assert.equal(dashboard.summary.access_audit_distinct_user_count, accessAuditProjection.summary.distinct_user_count);
      assert.equal(dashboard.summary.access_audit_distinct_runtime_count, accessAuditProjection.summary.distinct_runtime_count);
      assert.equal(dashboard.summary.access_audit_distinct_matter_count, accessAuditProjection.summary.distinct_matter_count);
      assert.equal(dashboard.summary.access_audit_distinct_resource_count, accessAuditProjection.summary.distinct_resource_count);
      assert.equal(dashboard.summary.access_audit_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.access_audit_validation_error_count, 0);
      assert.equal(dashboard.summary.store_policy_adapter_status, "complete");
      assert.equal(dashboard.summary.store_policy_source_access_audit_projection_status, "complete");
      assert.equal(dashboard.summary.store_policy_source_data_classification_rule_engine_status, "complete");
      assert.equal(dashboard.summary.store_policy_access_audit_record_count, storePolicyAdapter.summary.access_audit_record_count);
      assert.equal(dashboard.summary.store_policy_resource_classification_decision_count, storePolicyAdapter.summary.resource_classification_decision_count);
      assert.equal(dashboard.summary.store_policy_rule_count, storePolicyAdapter.summary.store_policy_rule_count);
      assert.equal(dashboard.summary.store_policy_rls_filter_template_count, storePolicyAdapter.summary.rls_filter_template_count);
      assert.equal(dashboard.summary.store_policy_query_policy_binding_count, storePolicyAdapter.summary.query_policy_binding_count);
      assert.equal(dashboard.summary.store_policy_store_query_plan_count, storePolicyAdapter.summary.store_query_plan_count);
      assert.equal(dashboard.summary.store_policy_enforcement_probe_count, storePolicyAdapter.summary.enforcement_probe_count);
      assert.equal(dashboard.summary.store_policy_rls_enforced_query_plan_count, storePolicyAdapter.summary.rls_enforced_query_plan_count);
      assert.equal(dashboard.summary.store_policy_matter_filter_enforced_count, storePolicyAdapter.summary.matter_filter_enforced_count);
      assert.equal(dashboard.summary.store_policy_classification_filter_enforced_count, storePolicyAdapter.summary.classification_filter_enforced_count);
      assert.equal(dashboard.summary.store_policy_policy_snapshot_filter_enforced_count, storePolicyAdapter.summary.policy_snapshot_filter_enforced_count);
      assert.equal(dashboard.summary.store_policy_access_audit_filter_enforced_count, storePolicyAdapter.summary.access_audit_filter_enforced_count);
      assert.equal(dashboard.summary.store_policy_resource_filter_enforced_count, storePolicyAdapter.summary.resource_filter_enforced_count);
      assert.equal(dashboard.summary.store_policy_executable_query_plan_count, storePolicyAdapter.summary.executable_query_plan_count);
      assert.equal(dashboard.summary.store_policy_held_query_plan_count, storePolicyAdapter.summary.held_query_plan_count);
      assert.equal(dashboard.summary.store_policy_blocked_query_plan_count, storePolicyAdapter.summary.blocked_query_plan_count);
      assert.equal(dashboard.summary.store_policy_unfiltered_probe_blocked_count, storePolicyAdapter.summary.unfiltered_probe_blocked_count);
      assert.equal(dashboard.summary.store_policy_cross_matter_probe_blocked_count, storePolicyAdapter.summary.cross_matter_probe_blocked_count);
      assert.equal(dashboard.summary.store_policy_missing_matter_filter_probe_blocked_count, storePolicyAdapter.summary.missing_matter_filter_probe_blocked_count);
      assert.equal(dashboard.summary.store_policy_missing_classification_filter_probe_blocked_count, storePolicyAdapter.summary.missing_classification_filter_probe_blocked_count);
      assert.equal(dashboard.summary.store_policy_missing_policy_snapshot_filter_probe_blocked_count, storePolicyAdapter.summary.missing_policy_snapshot_filter_probe_blocked_count);
      assert.equal(dashboard.summary.store_policy_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.store_policy_validation_error_count, 0);
      assert.equal(dashboard.summary.conflict_check_interface_status, "complete");
      assert.equal(dashboard.summary.conflict_check_source_client_counterparty_registry_status, "complete");
      assert.equal(dashboard.summary.conflict_check_source_matter_profile_team_ledger_status, "complete");
      assert.equal(dashboard.summary.conflict_check_source_wall_policy_contract_status, "complete");
      assert.equal(dashboard.summary.conflict_check_source_store_policy_adapter_status, "complete");
      assert.equal(dashboard.summary.conflict_check_matter_profile_count, conflictCheckInterface.summary.matter_profile_count);
      assert.equal(dashboard.summary.conflict_check_protected_resource_count, conflictCheckInterface.summary.protected_resource_count);
      assert.equal(dashboard.summary.conflict_check_reference_count, conflictCheckInterface.summary.conflict_reference_count);
      assert.equal(dashboard.summary.conflict_check_wall_binding_count, conflictCheckInterface.summary.conflict_wall_binding_count);
      assert.equal(dashboard.summary.conflict_check_store_query_plan_count, conflictCheckInterface.summary.store_query_plan_count);
      assert.equal(dashboard.summary.conflict_check_request_count, conflictCheckInterface.summary.conflict_check_request_count);
      assert.equal(dashboard.summary.conflict_check_matter_intake_request_count, conflictCheckInterface.summary.matter_intake_request_count);
      assert.equal(dashboard.summary.conflict_check_resource_access_request_count, conflictCheckInterface.summary.resource_access_request_count);
      assert.equal(dashboard.summary.conflict_check_result_count, conflictCheckInterface.summary.conflict_check_result_count);
      assert.equal(dashboard.summary.conflict_check_review_required_result_count, conflictCheckInterface.summary.review_required_result_count);
      assert.equal(dashboard.summary.conflict_check_blocked_result_count, 0);
      assert.equal(dashboard.summary.conflict_check_signal_count, conflictCheckInterface.summary.conflict_signal_count);
      assert.equal(dashboard.summary.conflict_check_clear_signal_count, conflictCheckInterface.summary.clear_signal_count);
      assert.equal(dashboard.summary.conflict_check_review_signal_count, conflictCheckInterface.summary.review_signal_count);
      assert.equal(dashboard.summary.conflict_check_block_signal_count, 0);
      assert.equal(dashboard.summary.conflict_check_client_signal_count, conflictCheckInterface.summary.client_signal_count);
      assert.equal(dashboard.summary.conflict_check_counterparty_signal_count, conflictCheckInterface.summary.counterparty_signal_count);
      assert.equal(dashboard.summary.conflict_check_store_plan_linked_request_count, conflictCheckInterface.summary.store_plan_linked_request_count);
      assert.equal(dashboard.summary.conflict_check_missing_conflict_reference_count, 0);
      assert.equal(dashboard.summary.conflict_check_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.conflict_check_validation_error_count, 0);
      assert.equal(dashboard.summary.personal_workspace_boundary_status, "complete");
      assert.equal(dashboard.summary.personal_workspace_workspace_boundary_count, personalWorkspaceBoundary.summary.workspace_boundary_count);
      assert.equal(dashboard.summary.personal_workspace_law_firm_boundary_count, 1);
      assert.equal(dashboard.summary.personal_workspace_personal_boundary_count, 1);
      assert.equal(dashboard.summary.personal_workspace_tenant_policy_boundary_count, personalWorkspaceBoundary.summary.tenant_policy_boundary_count);
      assert.equal(dashboard.summary.personal_workspace_search_namespace_policy_count, personalWorkspaceBoundary.summary.search_namespace_policy_count);
      assert.equal(dashboard.summary.personal_workspace_cross_workspace_probe_count, personalWorkspaceBoundary.summary.cross_workspace_probe_count);
      assert.equal(dashboard.summary.personal_workspace_blocked_cross_workspace_probe_count, personalWorkspaceBoundary.summary.blocked_cross_workspace_probe_count);
      assert.equal(dashboard.summary.personal_workspace_allowed_cross_workspace_probe_count, 0);
      assert.equal(dashboard.summary.personal_workspace_mixed_search_namespace_count, 0);
      assert.equal(dashboard.summary.personal_workspace_law_firm_resource_count, personalWorkspaceBoundary.summary.law_firm_resource_count);
      assert.equal(dashboard.summary.personal_workspace_personal_resource_count, personalWorkspaceBoundary.summary.personal_resource_count);
      assert.equal(dashboard.summary.personal_workspace_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.personal_workspace_validation_error_count, 0);
      assert.equal(dashboard.summary.policy_golden_fixture_status, "complete");
      assert.equal(dashboard.summary.policy_golden_fixture_case_count, policyGoldenFixtures.summary.policy_fixture_case_count);
      assert.equal(dashboard.summary.policy_golden_fixture_group_count, policyGoldenFixtures.summary.fixture_group_count);
      assert.equal(dashboard.summary.policy_golden_allow_case_count, policyGoldenFixtures.summary.allow_case_count);
      assert.equal(dashboard.summary.policy_golden_review_case_count, policyGoldenFixtures.summary.review_case_count);
      assert.equal(dashboard.summary.policy_golden_deny_case_count, policyGoldenFixtures.summary.deny_case_count);
      assert.equal(dashboard.summary.policy_golden_locked_case_count, policyGoldenFixtures.summary.locked_case_count);
      assert.equal(dashboard.summary.policy_golden_mismatch_case_count, 0);
      assert.equal(dashboard.summary.policy_golden_missing_case_count, 0);
      assert.equal(dashboard.summary.policy_golden_locked_regression_hash_count, policyGoldenFixtures.summary.locked_regression_hash_count);
      assert.equal(dashboard.summary.policy_golden_review_case_with_human_gate_count, policyGoldenFixtures.summary.review_case_with_human_gate_count);
      assert.equal(dashboard.summary.policy_golden_deny_case_blocked_count, policyGoldenFixtures.summary.deny_case_blocked_count);
      assert.equal(dashboard.summary.policy_golden_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.policy_golden_validation_error_count, 0);
      assert.equal(dashboard.summary.policy_operations_surface_status, "complete");
      assert.equal(dashboard.summary.policy_operations_decision_count, policyOperationsSurface.summary.policy_decision_row_count);
      assert.equal(dashboard.summary.policy_operations_allow_decision_count, policyOperationsSurface.summary.allow_decision_count);
      assert.equal(dashboard.summary.policy_operations_review_decision_count, policyOperationsSurface.summary.review_decision_count);
      assert.equal(dashboard.summary.policy_operations_deny_decision_count, policyOperationsSurface.summary.deny_decision_count);
      assert.equal(dashboard.summary.policy_operations_violation_count, policyOperationsSurface.summary.policy_violation_row_count);
      assert.equal(dashboard.summary.policy_operations_critical_violation_count, policyOperationsSurface.summary.critical_violation_count);
      assert.equal(dashboard.summary.policy_operations_warning_violation_count, policyOperationsSurface.summary.warning_violation_count);
      assert.equal(dashboard.summary.policy_operations_pending_approval_count, policyOperationsSurface.summary.policy_pending_approval_row_count);
      assert.equal(dashboard.summary.policy_operations_assignment_required_count, policyOperationsSurface.summary.assignment_required_approval_count);
      assert.equal(dashboard.summary.policy_operations_human_gate_pending_count, policyOperationsSurface.summary.human_gate_pending_approval_count);
      assert.equal(dashboard.summary.policy_operations_distinct_layer_count, policyOperationsSurface.summary.distinct_policy_layer_count);
      assert.equal(dashboard.summary.policy_operations_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.policy_operations_validation_error_count, 0);
      assert.equal(dashboard.summary.matter_boundary_slice_status, "complete");
      assert.equal(dashboard.summary.matter_boundary_resource_path_count, matterBoundarySlice.summary.resource_boundary_path_count);
      assert.equal(dashboard.summary.matter_boundary_retrieval_gate_check_count, matterBoundarySlice.summary.retrieval_gate_check_count);
      assert.equal(dashboard.summary.matter_boundary_promoted_resource_path_count, matterBoundarySlice.summary.promoted_resource_path_count);
      assert.equal(dashboard.summary.matter_boundary_access_decision_covered_resource_count, matterBoundarySlice.summary.access_decision_covered_resource_count);
      assert.equal(dashboard.summary.matter_boundary_access_audited_resource_count, matterBoundarySlice.summary.access_audited_resource_count);
      assert.equal(dashboard.summary.matter_boundary_store_compiled_resource_count, matterBoundarySlice.summary.store_compiled_resource_count);
      assert.equal(dashboard.summary.matter_boundary_required_store_filter_resource_count, matterBoundarySlice.summary.required_store_filter_resource_count);
      assert.equal(dashboard.summary.matter_boundary_negative_probe_blocked_resource_count, matterBoundarySlice.summary.negative_probe_blocked_resource_count);
      assert.equal(dashboard.summary.matter_boundary_policy_surface_visible_resource_count, matterBoundarySlice.summary.policy_surface_visible_resource_count);
      assert.equal(dashboard.summary.matter_boundary_unassigned_resource_count, matterBoundarySlice.summary.unassigned_resource_count);
      assert.equal(dashboard.summary.matter_boundary_unassigned_executable_query_plan_count, 0);
      assert.equal(dashboard.summary.matter_boundary_held_for_matter_tagging_resource_count, matterBoundarySlice.summary.held_for_matter_tagging_resource_count);
      assert.equal(dashboard.summary.matter_boundary_passed_retrieval_gate_check_count, matterBoundarySlice.summary.passed_retrieval_gate_check_count);
      assert.equal(dashboard.summary.matter_boundary_failed_retrieval_gate_check_count, 0);
      assert.equal(dashboard.summary.matter_boundary_negative_probe_expected_count, matterBoundarySlice.summary.negative_probe_expected_count);
      assert.equal(dashboard.summary.matter_boundary_negative_probe_blocked_count, matterBoundarySlice.summary.negative_probe_blocked_count);
      assert.equal(dashboard.summary.matter_boundary_validation_error_count, 0);
      assert.equal(dashboard.summary.identity_policy_matter_freeze_status, "frozen_with_pending_human_actions");
      assert.equal(dashboard.summary.identity_policy_matter_freeze_source_count, identityPolicyMatterFreeze.summary.required_source_count);
      assert.equal(dashboard.summary.identity_policy_matter_freeze_available_source_count, identityPolicyMatterFreeze.summary.available_required_source_count);
      assert.equal(dashboard.summary.identity_policy_matter_freeze_clean_source_count, identityPolicyMatterFreeze.summary.clean_source_count);
      assert.equal(dashboard.summary.identity_policy_matter_freeze_frozen_slot_count, 20);
      assert.equal(dashboard.summary.identity_policy_matter_freeze_checkpoint_count, identityPolicyMatterFreeze.summary.freeze_checkpoint_count);
      assert.equal(dashboard.summary.identity_policy_matter_freeze_passed_checkpoint_count, identityPolicyMatterFreeze.summary.passed_freeze_checkpoint_count);
      assert.equal(dashboard.summary.identity_policy_matter_freeze_failed_checkpoint_count, 0);
      assert.equal(dashboard.summary.identity_policy_matter_freeze_policy_fixture_case_count, identityPolicyMatterFreeze.summary.policy_fixture_case_count);
      assert.equal(dashboard.summary.identity_policy_matter_freeze_locked_policy_fixture_count, identityPolicyMatterFreeze.summary.locked_policy_fixture_count);
      assert.equal(dashboard.summary.identity_policy_matter_freeze_policy_decision_row_count, identityPolicyMatterFreeze.summary.policy_decision_row_count);
      assert.equal(dashboard.summary.identity_policy_matter_freeze_policy_pending_approval_row_count, identityPolicyMatterFreeze.summary.policy_pending_approval_row_count);
      assert.equal(dashboard.summary.identity_policy_matter_freeze_resource_boundary_path_count, identityPolicyMatterFreeze.summary.resource_boundary_path_count);
      assert.equal(dashboard.summary.identity_policy_matter_freeze_retrieval_gate_check_count, identityPolicyMatterFreeze.summary.retrieval_gate_check_count);
      assert.equal(dashboard.summary.identity_policy_matter_freeze_unassigned_executable_query_plan_count, 0);
      assert.equal(dashboard.summary.identity_policy_matter_freeze_protected_action_executed_count, 0);
      assert.equal(dashboard.summary.identity_policy_matter_freeze_validation_error_count, 0);
      assert.equal(dashboard.summary.resource_store_interface_status, "complete");
      assert.equal(dashboard.summary.resource_store_interface_contract_id, "resource-store-interface.v1");
      assert.equal(dashboard.summary.resource_store_interface_resource_record_count, resourceStoreInterface.summary.resource_store_record_count);
      assert.equal(dashboard.summary.resource_store_interface_resource_version_record_count, resourceStoreInterface.summary.resource_version_store_record_count);
      assert.equal(dashboard.summary.resource_store_interface_registry_projection_count, resourceStoreInterface.summary.registry_projection_count);
      assert.equal(dashboard.summary.resource_store_interface_dashboard_projection_route_count, resourceStoreInterface.summary.dashboard_projection_route_count);
      assert.equal(dashboard.summary.resource_store_interface_adapter_binding_count, resourceStoreInterface.summary.adapter_binding_count);
      assert.equal(dashboard.summary.resource_store_interface_registry_adapter_binding_count, 1);
      assert.equal(dashboard.summary.resource_store_interface_ingestion_adapter_binding_count, 1);
      assert.equal(dashboard.summary.resource_store_interface_dashboard_adapter_binding_count, 1);
      assert.equal(dashboard.summary.resource_store_interface_bound_required_consumer_layer_count, resourceStoreInterface.summary.required_consumer_layer_count);
      assert.equal(dashboard.summary.resource_store_interface_required_resource_filter_count, 4);
      assert.equal(dashboard.summary.resource_store_interface_resource_store_rls_template_count, resourceStoreInterface.summary.resource_store_rls_template_count);
      assert.equal(dashboard.summary.resource_store_interface_compiled_query_plan_count, resourceStoreInterface.summary.compiled_resource_query_plan_count);
      assert.equal(dashboard.summary.resource_store_interface_executable_query_plan_count, 0);
      assert.equal(dashboard.summary.resource_store_interface_validation_error_count, 0);
      assert.equal(dashboard.summary.immutable_object_store_layout_status, "complete");
      assert.equal(dashboard.summary.immutable_object_store_layout_contract_id, "immutable-object-store-layout.v1");
      assert.equal(dashboard.summary.immutable_object_store_layout_root, "object-store/immutable");
      assert.equal(dashboard.summary.immutable_object_store_namespace_count, immutableObjectStoreLayout.summary.namespace_count);
      assert.equal(dashboard.summary.immutable_object_store_path_resolver_count, immutableObjectStoreLayout.summary.path_resolver_count);
      assert.equal(dashboard.summary.immutable_object_store_raw_source_object_path_count, immutableObjectStoreLayout.summary.raw_source_object_path_count);
      assert.equal(dashboard.summary.immutable_object_store_generated_output_object_path_count, immutableObjectStoreLayout.summary.generated_output_object_path_count);
      assert.equal(dashboard.summary.immutable_object_store_total_object_path_count, immutableObjectStoreLayout.summary.total_object_path_count);
      assert.equal(dashboard.summary.immutable_object_store_collision_count, 0);
      assert.equal(dashboard.summary.immutable_object_store_content_addressed_path_count, immutableObjectStoreLayout.summary.total_object_path_count);
      assert.equal(dashboard.summary.immutable_object_store_absolute_source_path_key_count, 0);
      assert.equal(dashboard.summary.immutable_object_store_validation_error_count, 0);
      assert.equal(dashboard.summary.resource_version_ledger_status, "complete");
      assert.equal(dashboard.summary.resource_version_ledger_contract_id, "resource-version-ledger.v1");
      assert.equal(dashboard.summary.resource_version_ledger_family_count, resourceVersionLedger.summary.version_family_count);
      assert.equal(dashboard.summary.resource_version_ledger_resource_version_count, resourceVersionLedger.summary.resource_version_count);
      assert.equal(dashboard.summary.resource_version_ledger_current_version_count, resourceVersionLedger.summary.current_version_count);
      assert.equal(dashboard.summary.resource_version_ledger_content_hash_group_count, resourceVersionLedger.summary.content_hash_group_count);
      assert.equal(dashboard.summary.resource_version_ledger_duplicate_candidate_count, resourceVersionLedger.summary.duplicate_candidate_count);
      assert.equal(dashboard.summary.resource_version_ledger_event_count, resourceVersionLedger.summary.version_event_count);
      assert.equal(dashboard.summary.resource_version_ledger_object_path_binding_count, resourceVersionLedger.summary.object_path_binding_count);
      assert.equal(dashboard.summary.resource_version_ledger_unbound_object_path_count, 0);
      assert.equal(dashboard.summary.resource_version_ledger_validation_error_count, 0);
      assert.equal(dashboard.summary.normalized_text_contract_status, "complete");
      assert.equal(dashboard.summary.normalized_text_contract_id, "normalized-text-artifact.v1");
      assert.equal(dashboard.summary.normalized_text_source_count, normalizedTextContract.summary.source_normalized_text_count);
      assert.equal(dashboard.summary.normalized_text_artifact_count, normalizedTextContract.summary.normalized_text_artifact_count);
      assert.equal(dashboard.summary.normalized_text_resource_version_link_count, normalizedTextContract.summary.resource_version_link_count);
      assert.equal(dashboard.summary.normalized_text_version_family_link_count, normalizedTextContract.summary.version_family_link_count);
      assert.equal(dashboard.summary.normalized_text_raw_source_bound_count, normalizedTextContract.summary.raw_source_bound_count);
      assert.equal(dashboard.summary.normalized_text_hash_count, normalizedTextContract.summary.text_hash_count);
      assert.equal(dashboard.summary.normalized_text_location_map_count, normalizedTextContract.summary.location_map_count);
      assert.equal(dashboard.summary.normalized_text_source_span_seed_count, normalizedTextContract.summary.source_span_seed_count);
      assert.equal(dashboard.summary.normalized_text_source_span_seed_ready_count, normalizedTextContract.summary.source_span_seed_ready_count);
      assert.equal(dashboard.summary.normalized_text_page_unit_count, normalizedTextContract.summary.page_unit_count);
      assert.equal(dashboard.summary.normalized_text_paragraph_unit_count, normalizedTextContract.summary.paragraph_unit_count);
      assert.equal(dashboard.summary.normalized_text_line_unit_count, normalizedTextContract.summary.line_unit_count);
      assert.equal(dashboard.summary.normalized_text_validation_error_count, 0);
      assert.equal(dashboard.summary.extractor_adapter_contract_status, "complete");
      assert.equal(dashboard.summary.extractor_adapter_contract_id, "extractor-adapter-contract.v1");
      assert.equal(dashboard.summary.extractor_adapter_count, extractorAdapterContract.summary.extractor_adapter_count);
      assert.equal(dashboard.summary.extractor_io_contract_count, extractorAdapterContract.summary.extractor_io_contract_count);
      assert.equal(dashboard.summary.extractor_document_type_binding_count, extractorAdapterContract.summary.document_type_binding_count);
      assert.equal(dashboard.summary.extractor_ocr_fallback_policy_count, extractorAdapterContract.summary.ocr_fallback_policy_count);
      assert.equal(dashboard.summary.extractor_normalized_text_binding_count, extractorAdapterContract.summary.normalized_text_binding_count);
      assert.equal(dashboard.summary.extractor_bound_normalized_text_count, extractorAdapterContract.summary.bound_normalized_text_count);
      assert.equal(dashboard.summary.extractor_unbound_normalized_text_count, 0);
      assert.equal(dashboard.summary.extractor_external_service_adapter_count, 0);
      assert.equal(dashboard.summary.extractor_validation_error_count, 0);
      assert.equal(dashboard.summary.source_span_store_status, "complete");
      assert.equal(dashboard.summary.source_span_store_contract_id, "source-span-store.v1");
      assert.equal(dashboard.summary.source_span_schema_version, "source-span.v2");
      assert.equal(dashboard.summary.source_span_normalized_text_artifact_count, sourceSpanStore.summary.normalized_text_artifact_count);
      assert.equal(dashboard.summary.source_span_seed_count, sourceSpanStore.summary.source_span_seed_count);
      assert.equal(dashboard.summary.source_span_count, sourceSpanStore.summary.source_span_count);
      assert.equal(dashboard.summary.source_span_locator_count, sourceSpanStore.summary.source_span_locator_count);
      assert.equal(dashboard.summary.source_span_location_unit_count, sourceSpanStore.summary.source_span_location_unit_count);
      assert.equal(dashboard.summary.source_span_whole_document_count, sourceSpanStore.summary.whole_document_span_count);
      assert.equal(dashboard.summary.source_span_page_count, sourceSpanStore.summary.page_span_count);
      assert.equal(dashboard.summary.source_span_paragraph_count, sourceSpanStore.summary.paragraph_span_count);
      assert.equal(dashboard.summary.source_span_line_count, sourceSpanStore.summary.line_span_count);
      assert.equal(dashboard.summary.source_span_char_range_count, sourceSpanStore.summary.char_range_span_count);
      assert.equal(dashboard.summary.source_span_timestamp_count, 0);
      assert.equal(dashboard.summary.source_span_timestamp_not_applicable_count, sourceSpanStore.summary.timestamp_not_applicable_count);
      assert.equal(dashboard.summary.source_span_extractor_bound_count, sourceSpanStore.summary.extractor_bound_span_count);
      assert.equal(dashboard.summary.source_span_canonical_offset_count, sourceSpanStore.summary.canonical_offset_span_count);
      assert.equal(dashboard.summary.source_span_validation_error_count, 0);
      assert.equal(dashboard.summary.evidence_item_store_status, "complete");
      assert.equal(dashboard.summary.evidence_item_store_contract_id, "evidence-item-store.v1");
      assert.equal(dashboard.summary.evidence_item_store_schema_version, "evidence-item.v2");
      assert.equal(dashboard.summary.evidence_item_store_source_span_count, evidenceItemStore.summary.source_span_count);
      assert.equal(dashboard.summary.evidence_item_store_evidence_item_count, evidenceItemStore.summary.evidence_item_count);
      assert.equal(dashboard.summary.evidence_item_store_binding_count, evidenceItemStore.summary.evidence_source_span_binding_count);
      assert.equal(dashboard.summary.evidence_item_store_review_queue_count, evidenceItemStore.summary.review_queue_item_count);
      assert.equal(dashboard.summary.evidence_item_store_linked_source_span_count, evidenceItemStore.summary.source_span_linked_evidence_count);
      assert.equal(dashboard.summary.evidence_item_store_matter_preserved_count, evidenceItemStore.summary.matter_preserved_evidence_count);
      assert.equal(dashboard.summary.evidence_item_store_classification_preserved_count, evidenceItemStore.summary.classification_preserved_evidence_count);
      assert.equal(dashboard.summary.evidence_item_store_policy_snapshot_preserved_count, evidenceItemStore.summary.policy_snapshot_preserved_evidence_count);
      assert.equal(dashboard.summary.evidence_item_store_machine_extracted_count, evidenceItemStore.summary.machine_extracted_evidence_count);
      assert.equal(dashboard.summary.evidence_item_store_needs_review_count, evidenceItemStore.summary.needs_review_count);
      assert.equal(dashboard.summary.evidence_item_store_approved_count, 0);
      assert.equal(dashboard.summary.evidence_item_store_validation_error_count, 0);
      assert.equal(dashboard.summary.fact_claim_store_status, "complete");
      assert.equal(dashboard.summary.fact_claim_store_contract_id, "fact-claim-store.v1");
      assert.equal(dashboard.summary.fact_claim_store_schema_version, "fact-claim.v2");
      assert.equal(dashboard.summary.fact_claim_store_evidence_item_count, factClaimStore.summary.evidence_item_count);
      assert.equal(dashboard.summary.fact_claim_store_fact_claim_count, factClaimStore.summary.fact_claim_count);
      assert.equal(dashboard.summary.fact_claim_store_binding_count, factClaimStore.summary.fact_evidence_binding_count);
      assert.equal(dashboard.summary.fact_claim_store_review_queue_count, factClaimStore.summary.review_queue_item_count);
      assert.equal(dashboard.summary.fact_claim_store_linked_evidence_count, factClaimStore.summary.evidence_linked_fact_count);
      assert.equal(dashboard.summary.fact_claim_store_reliability_preserved_count, factClaimStore.summary.reliability_preserved_fact_count);
      assert.equal(dashboard.summary.fact_claim_store_matter_preserved_count, factClaimStore.summary.matter_preserved_fact_count);
      assert.equal(dashboard.summary.fact_claim_store_classification_preserved_count, factClaimStore.summary.classification_preserved_fact_count);
      assert.equal(dashboard.summary.fact_claim_store_policy_snapshot_preserved_count, factClaimStore.summary.policy_snapshot_preserved_fact_count);
      assert.equal(dashboard.summary.fact_claim_store_machine_extracted_count, factClaimStore.summary.machine_extracted_fact_count);
      assert.equal(dashboard.summary.fact_claim_store_needs_review_count, factClaimStore.summary.needs_review_count);
      assert.equal(dashboard.summary.fact_claim_store_approved_count, 0);
      assert.equal(dashboard.summary.fact_claim_store_validation_error_count, 0);
      assert.equal(dashboard.summary.issue_graph_store_status, "complete");
      assert.equal(dashboard.summary.issue_graph_store_contract_id, "issue-graph-store.v1");
      assert.equal(dashboard.summary.issue_graph_store_schema_version, "issue.v2");
      assert.equal(dashboard.summary.issue_graph_store_legal_rule_schema_version, "legal-rule.v1");
      assert.equal(dashboard.summary.issue_graph_store_fact_claim_count, issueGraphStore.summary.fact_claim_count);
      assert.equal(dashboard.summary.issue_graph_store_issue_count, issueGraphStore.summary.issue_count);
      assert.equal(dashboard.summary.issue_graph_store_fact_issue_binding_count, issueGraphStore.summary.fact_issue_binding_count);
      assert.equal(dashboard.summary.issue_graph_store_legal_rule_count, issueGraphStore.summary.legal_rule_count);
      assert.equal(dashboard.summary.issue_graph_store_legal_rule_binding_count, issueGraphStore.summary.legal_rule_binding_count);
      assert.equal(dashboard.summary.issue_graph_store_risk_severity_assessment_count, issueGraphStore.summary.risk_severity_assessment_count);
      assert.equal(dashboard.summary.issue_graph_store_review_queue_count, issueGraphStore.summary.review_queue_item_count);
      assert.equal(dashboard.summary.issue_graph_store_fact_linked_issue_count, issueGraphStore.summary.fact_linked_issue_count);
      assert.equal(dashboard.summary.issue_graph_store_legal_rule_linked_issue_count, issueGraphStore.summary.legal_rule_linked_issue_count);
      assert.equal(dashboard.summary.issue_graph_store_risk_severity_linked_issue_count, issueGraphStore.summary.risk_severity_linked_issue_count);
      assert.equal(dashboard.summary.issue_graph_store_matter_preserved_count, issueGraphStore.summary.matter_preserved_issue_count);
      assert.equal(dashboard.summary.issue_graph_store_classification_preserved_count, issueGraphStore.summary.classification_preserved_issue_count);
      assert.equal(dashboard.summary.issue_graph_store_policy_snapshot_preserved_count, issueGraphStore.summary.policy_snapshot_preserved_issue_count);
      assert.equal(dashboard.summary.issue_graph_store_evidence_links_preserved_count, issueGraphStore.summary.evidence_links_preserved_issue_count);
      assert.equal(dashboard.summary.issue_graph_store_needs_review_count, issueGraphStore.summary.needs_review_count);
      assert.equal(dashboard.summary.issue_graph_store_approved_count, 0);
      assert.equal(dashboard.summary.issue_graph_store_high_severity_count, issueGraphStore.summary.high_severity_count);
      assert.equal(dashboard.summary.issue_graph_store_medium_severity_count, issueGraphStore.summary.medium_severity_count);
      assert.equal(dashboard.summary.issue_graph_store_low_severity_count, issueGraphStore.summary.low_severity_count);
      assert.equal(dashboard.summary.issue_graph_store_validation_error_count, 0);
      assert.equal(dashboard.summary.citation_object_store_status, "complete");
      assert.equal(dashboard.summary.citation_object_store_contract_id, "citation-object-store.v1");
      assert.equal(dashboard.summary.citation_object_store_citation_schema_version, "citation.v2");
      assert.equal(dashboard.summary.citation_object_store_output_paragraph_schema_version, "output-paragraph.v1");
      assert.equal(dashboard.summary.citation_object_store_paragraph_source_binding_schema_version, "paragraph-source-binding.v1");
      assert.equal(dashboard.summary.citation_object_store_issue_graph_store_status, "complete");
      assert.equal(dashboard.summary.citation_object_store_issue_count, citationObjectStore.summary.issue_count);
      assert.equal(dashboard.summary.citation_object_store_output_paragraph_count, citationObjectStore.summary.output_paragraph_count);
      assert.equal(dashboard.summary.citation_object_store_citation_count, citationObjectStore.summary.citation_count);
      assert.equal(dashboard.summary.citation_object_store_paragraph_source_binding_count, citationObjectStore.summary.paragraph_source_binding_count);
      assert.equal(dashboard.summary.citation_object_store_review_queue_count, citationObjectStore.summary.review_queue_item_count);
      assert.equal(dashboard.summary.citation_object_store_source_span_bound_count, citationObjectStore.summary.source_span_bound_citation_count);
      assert.equal(dashboard.summary.citation_object_store_issue_linked_count, citationObjectStore.summary.issue_linked_citation_count);
      assert.equal(dashboard.summary.citation_object_store_paragraph_linked_count, citationObjectStore.summary.paragraph_linked_citation_count);
      assert.equal(dashboard.summary.citation_object_store_fact_linked_count, citationObjectStore.summary.fact_linked_citation_count);
      assert.equal(dashboard.summary.citation_object_store_evidence_linked_count, citationObjectStore.summary.evidence_linked_citation_count);
      assert.equal(dashboard.summary.citation_object_store_matter_preserved_count, citationObjectStore.summary.matter_preserved_citation_count);
      assert.equal(dashboard.summary.citation_object_store_classification_preserved_count, citationObjectStore.summary.classification_preserved_citation_count);
      assert.equal(dashboard.summary.citation_object_store_policy_snapshot_preserved_count, citationObjectStore.summary.policy_snapshot_preserved_citation_count);
      assert.equal(dashboard.summary.citation_object_store_issue_link_preserved_count, citationObjectStore.summary.issue_link_preserved_citation_count);
      assert.equal(dashboard.summary.citation_object_store_needs_review_count, citationObjectStore.summary.needs_review_count);
      assert.equal(dashboard.summary.citation_object_store_approved_count, 0);
      assert.equal(dashboard.summary.citation_object_store_client_facing_ready_count, 0);
      assert.equal(dashboard.summary.citation_object_store_not_client_facing_paragraph_count, citationObjectStore.summary.not_client_facing_paragraph_count);
      assert.equal(dashboard.summary.citation_object_store_validation_error_count, 0);
      assert.equal(dashboard.summary.lineage_graph_builder_status, "complete");
      assert.equal(dashboard.summary.lineage_graph_builder_contract_id, "lineage-graph-builder.v1");
      assert.equal(dashboard.summary.lineage_graph_builder_node_schema_version, "lineage-node.v1");
      assert.equal(dashboard.summary.lineage_graph_builder_edge_schema_version, "lineage-edge.v1");
      assert.equal(dashboard.summary.lineage_graph_builder_path_schema_version, "lineage-path.v1");
      assert.equal(dashboard.summary.lineage_graph_builder_citation_object_store_status, "complete");
      assert.equal(dashboard.summary.lineage_graph_builder_node_count, lineageGraphBuilder.summary.lineage_node_count);
      assert.equal(dashboard.summary.lineage_graph_builder_source_span_node_count, lineageGraphBuilder.summary.source_span_node_count);
      assert.equal(dashboard.summary.lineage_graph_builder_evidence_item_node_count, lineageGraphBuilder.summary.evidence_item_node_count);
      assert.equal(dashboard.summary.lineage_graph_builder_fact_claim_node_count, lineageGraphBuilder.summary.fact_claim_node_count);
      assert.equal(dashboard.summary.lineage_graph_builder_issue_node_count, lineageGraphBuilder.summary.issue_node_count);
      assert.equal(dashboard.summary.lineage_graph_builder_output_paragraph_node_count, lineageGraphBuilder.summary.output_paragraph_node_count);
      assert.equal(dashboard.summary.lineage_graph_builder_edge_count, lineageGraphBuilder.summary.lineage_edge_count);
      assert.equal(dashboard.summary.lineage_graph_builder_expected_edge_count, lineageGraphBuilder.summary.expected_lineage_edge_count);
      assert.equal(dashboard.summary.lineage_graph_builder_path_count, lineageGraphBuilder.summary.lineage_path_count);
      assert.equal(dashboard.summary.lineage_graph_builder_complete_path_count, lineageGraphBuilder.summary.complete_lineage_path_count);
      assert.equal(dashboard.summary.lineage_graph_builder_broken_path_count, 0);
      assert.equal(dashboard.summary.lineage_graph_builder_source_to_output_path_count, lineageGraphBuilder.summary.source_to_output_path_count);
      assert.equal(dashboard.summary.lineage_graph_builder_citation_bound_count, lineageGraphBuilder.summary.citation_bound_lineage_count);
      assert.equal(dashboard.summary.lineage_graph_builder_matter_preserved_count, lineageGraphBuilder.summary.matter_preserved_path_count);
      assert.equal(dashboard.summary.lineage_graph_builder_classification_preserved_count, lineageGraphBuilder.summary.classification_preserved_path_count);
      assert.equal(dashboard.summary.lineage_graph_builder_policy_snapshot_preserved_count, lineageGraphBuilder.summary.policy_snapshot_preserved_path_count);
      assert.equal(dashboard.summary.lineage_graph_builder_needs_review_count, lineageGraphBuilder.summary.needs_review_path_count);
      assert.equal(dashboard.summary.lineage_graph_builder_not_client_facing_output_path_count, lineageGraphBuilder.summary.not_client_facing_output_path_count);
      assert.equal(dashboard.summary.lineage_graph_builder_client_facing_ready_path_count, 0);
      assert.equal(dashboard.summary.lineage_graph_builder_validation_error_count, 0);
      assert.equal(dashboard.summary.evidence_coverage_status, "complete");
      assert.equal(dashboard.summary.evidence_coverage_contract_id, "evidence-coverage-score.v1");
      assert.equal(dashboard.summary.evidence_coverage_score_schema_version, "coverage-score.v1");
      assert.equal(dashboard.summary.evidence_coverage_dimension_schema_version, "coverage-dimension.v1");
      assert.equal(dashboard.summary.evidence_coverage_lineage_graph_status, "complete");
      assert.equal(dashboard.summary.evidence_coverage_score_count, evidenceCoverageScore.summary.coverage_score_count);
      assert.equal(dashboard.summary.evidence_coverage_dimension_count, evidenceCoverageScore.summary.coverage_dimension_count);
      assert.equal(dashboard.summary.evidence_coverage_required_dimension_count, evidenceCoverageScore.summary.required_dimension_count);
      assert.equal(dashboard.summary.evidence_coverage_covered_required_dimension_count, evidenceCoverageScore.summary.covered_required_dimension_count);
      assert.equal(dashboard.summary.evidence_coverage_missing_required_dimension_count, evidenceCoverageScore.summary.missing_required_dimension_count);
      assert.equal(dashboard.summary.evidence_coverage_full_score_count, evidenceCoverageScore.summary.full_coverage_score_count);
      assert.equal(dashboard.summary.evidence_coverage_partial_score_count, evidenceCoverageScore.summary.partial_coverage_score_count);
      assert.equal(dashboard.summary.evidence_coverage_claim_dimension_count, evidenceCoverageScore.summary.claim_dimension_count);
      assert.equal(dashboard.summary.evidence_coverage_claim_covered_count, evidenceCoverageScore.summary.claim_covered_count);
      assert.equal(dashboard.summary.evidence_coverage_legal_basis_dimension_count, evidenceCoverageScore.summary.legal_basis_dimension_count);
      assert.equal(dashboard.summary.evidence_coverage_legal_basis_covered_count, evidenceCoverageScore.summary.legal_basis_covered_count);
      assert.equal(dashboard.summary.evidence_coverage_matter_preserved_count, evidenceCoverageScore.summary.matter_preserved_score_count);
      assert.equal(dashboard.summary.evidence_coverage_classification_preserved_count, evidenceCoverageScore.summary.classification_preserved_score_count);
      assert.equal(dashboard.summary.evidence_coverage_policy_snapshot_preserved_count, evidenceCoverageScore.summary.policy_snapshot_preserved_score_count);
      assert.equal(dashboard.summary.evidence_coverage_needs_review_count, evidenceCoverageScore.summary.needs_review_score_count);
      assert.equal(dashboard.summary.evidence_coverage_not_client_facing_output_count, evidenceCoverageScore.summary.not_client_facing_output_score_count);
      assert.equal(dashboard.summary.evidence_coverage_client_facing_ready_count, 0);
      assert.equal(dashboard.summary.evidence_coverage_validation_error_count, 0);
      assert.equal(dashboard.summary.evidence_flags_status, "complete");
      assert.equal(dashboard.summary.evidence_flags_contract_id, "evidence-flags.v1");
      assert.equal(dashboard.summary.evidence_flags_record_count, evidenceFlags.summary.evidence_flag_record_count);
      assert.equal(dashboard.summary.evidence_flags_decision_count, evidenceFlags.summary.flag_decision_count);
      assert.equal(dashboard.summary.evidence_flags_machine_extracted_count, evidenceFlags.summary.machine_extracted_count);
      assert.equal(dashboard.summary.evidence_flags_pending_human_confirmation_count, evidenceFlags.summary.pending_human_confirmation_count);
      assert.equal(dashboard.summary.evidence_flags_privileged_review_required_count, evidenceFlags.summary.privileged_review_required_count);
      assert.equal(dashboard.summary.evidence_flags_client_confidential_review_required_count, evidenceFlags.summary.client_confidential_review_required_count);
      assert.equal(dashboard.summary.evidence_flags_redaction_required_count, evidenceFlags.summary.redaction_required_count);
      assert.equal(dashboard.summary.evidence_flags_redaction_review_required_count, evidenceFlags.summary.redaction_review_required_count);
      assert.equal(dashboard.summary.evidence_flags_external_transfer_blocked_count, evidenceFlags.summary.external_transfer_blocked_count);
      assert.equal(dashboard.summary.evidence_flags_external_transfer_requires_approval_count, evidenceFlags.summary.external_transfer_requires_approval_count);
      assert.equal(dashboard.summary.evidence_flags_matter_preserved_count, evidenceFlags.summary.matter_preserved_record_count);
      assert.equal(dashboard.summary.evidence_flags_classification_preserved_count, evidenceFlags.summary.classification_preserved_record_count);
      assert.equal(dashboard.summary.evidence_flags_policy_snapshot_preserved_count, evidenceFlags.summary.policy_snapshot_preserved_record_count);
      assert.equal(dashboard.summary.evidence_flags_needs_review_count, evidenceFlags.summary.needs_review_record_count);
      assert.equal(dashboard.summary.evidence_flags_not_client_facing_count, evidenceFlags.summary.not_client_facing_record_count);
      assert.equal(dashboard.summary.evidence_flags_client_facing_ready_count, 0);
      assert.equal(dashboard.summary.evidence_flags_validation_error_count, 0);
      assert.equal(dashboard.summary.exhibit_map_status, "complete");
      assert.equal(dashboard.summary.exhibit_map_contract_id, "exhibit-map.v1");
      assert.equal(dashboard.summary.exhibit_map_record_count, exhibitMap.summary.exhibit_record_count);
      assert.equal(dashboard.summary.exhibit_map_binding_count, exhibitMap.summary.exhibit_binding_count);
      assert.equal(dashboard.summary.exhibit_map_expected_binding_count, exhibitMap.summary.expected_exhibit_binding_count);
      assert.equal(dashboard.summary.exhibit_map_unique_number_count, exhibitMap.summary.unique_exhibit_number_count);
      assert.equal(dashboard.summary.exhibit_map_evidence_linked_count, exhibitMap.summary.evidence_linked_exhibit_count);
      assert.equal(dashboard.summary.exhibit_map_citation_linked_count, exhibitMap.summary.citation_linked_exhibit_count);
      assert.equal(dashboard.summary.exhibit_map_output_paragraph_linked_count, exhibitMap.summary.output_paragraph_linked_exhibit_count);
      assert.equal(dashboard.summary.exhibit_map_lineage_path_linked_count, exhibitMap.summary.lineage_path_linked_exhibit_count);
      assert.equal(dashboard.summary.exhibit_map_bound_binding_count, exhibitMap.summary.bound_exhibit_binding_count);
      assert.equal(dashboard.summary.exhibit_map_matter_preserved_count, exhibitMap.summary.matter_preserved_exhibit_count);
      assert.equal(dashboard.summary.exhibit_map_classification_preserved_count, exhibitMap.summary.classification_preserved_exhibit_count);
      assert.equal(dashboard.summary.exhibit_map_policy_snapshot_preserved_count, exhibitMap.summary.policy_snapshot_preserved_exhibit_count);
      assert.equal(dashboard.summary.exhibit_map_needs_review_count, exhibitMap.summary.needs_review_exhibit_count);
      assert.equal(dashboard.summary.exhibit_map_attorney_review_required_count, exhibitMap.summary.attorney_review_required_exhibit_count);
      assert.equal(dashboard.summary.exhibit_map_not_client_facing_count, exhibitMap.summary.not_client_facing_exhibit_count);
      assert.equal(dashboard.summary.exhibit_map_client_facing_ready_count, 0);
      assert.equal(dashboard.summary.exhibit_map_external_transfer_requires_approval_count, exhibitMap.summary.external_transfer_requires_approval_count);
      assert.equal(dashboard.summary.exhibit_map_validation_error_count, 0);
      assert.equal(dashboard.summary.chain_of_custody_events_status, "complete");
      assert.equal(dashboard.summary.chain_of_custody_events_contract_id, "chain-of-custody-events.v1");
      assert.equal(dashboard.summary.chain_of_custody_events_event_count, chainOfCustodyEvents.summary.custody_event_count);
      assert.equal(dashboard.summary.chain_of_custody_events_link_count, chainOfCustodyEvents.summary.custody_event_link_count);
      assert.equal(dashboard.summary.chain_of_custody_events_upload_count, chainOfCustodyEvents.summary.upload_event_count);
      assert.equal(dashboard.summary.chain_of_custody_events_normalize_count, chainOfCustodyEvents.summary.normalize_event_count);
      assert.equal(dashboard.summary.chain_of_custody_events_extract_count, chainOfCustodyEvents.summary.extract_event_count);
      assert.equal(dashboard.summary.chain_of_custody_events_review_count, chainOfCustodyEvents.summary.review_event_count);
      assert.equal(dashboard.summary.chain_of_custody_events_approve_count, chainOfCustodyEvents.summary.approve_event_count);
      assert.equal(dashboard.summary.chain_of_custody_events_append_only_count, chainOfCustodyEvents.summary.append_only_event_count);
      assert.equal(dashboard.summary.chain_of_custody_events_hashed_count, chainOfCustodyEvents.summary.hashed_event_count);
      assert.equal(dashboard.summary.chain_of_custody_events_previous_hash_linked_count, chainOfCustodyEvents.summary.previous_hash_linked_event_count);
      assert.equal(dashboard.summary.chain_of_custody_events_complete_resource_chain_count, chainOfCustodyEvents.summary.complete_resource_chain_count);
      assert.equal(dashboard.summary.chain_of_custody_events_complete_evidence_chain_count, chainOfCustodyEvents.summary.complete_evidence_chain_count);
      assert.equal(dashboard.summary.chain_of_custody_events_matter_preserved_count, chainOfCustodyEvents.summary.matter_preserved_event_count);
      assert.equal(dashboard.summary.chain_of_custody_events_classification_preserved_count, chainOfCustodyEvents.summary.classification_preserved_event_count);
      assert.equal(dashboard.summary.chain_of_custody_events_policy_snapshot_preserved_count, chainOfCustodyEvents.summary.policy_snapshot_preserved_event_count);
      assert.equal(dashboard.summary.chain_of_custody_events_pending_approval_count, chainOfCustodyEvents.summary.pending_approval_event_count);
      assert.equal(dashboard.summary.chain_of_custody_events_approved_count, 0);
      assert.equal(dashboard.summary.chain_of_custody_events_client_facing_ready_count, 0);
      assert.equal(dashboard.summary.chain_of_custody_events_validation_error_count, 0);
      assert.equal(dashboard.summary.search_index_contract_status, "complete");
      assert.equal(dashboard.summary.search_index_contract_id, "search-index-contract.v1");
      assert.equal(dashboard.summary.search_index_source_collection_count, searchIndexContract.summary.source_collection_count);
      assert.equal(dashboard.summary.search_index_manifest_count, searchIndexContract.summary.search_index_manifest_count);
      assert.equal(dashboard.summary.search_index_field_count, searchIndexContract.summary.search_index_field_count);
      assert.equal(dashboard.summary.search_index_required_filter_field_count, searchIndexContract.summary.required_filter_field_count);
      assert.equal(dashboard.summary.search_index_query_plan_count, searchIndexContract.summary.search_index_query_plan_count);
      assert.equal(dashboard.summary.search_index_filters_enforced_query_plan_count, searchIndexContract.summary.filters_enforced_query_plan_count);
      assert.equal(dashboard.summary.search_index_tenant_filter_required_query_plan_count, searchIndexContract.summary.search_index_query_plan_count);
      assert.equal(dashboard.summary.search_index_matter_filter_required_query_plan_count, searchIndexContract.summary.search_index_query_plan_count);
      assert.equal(dashboard.summary.search_index_classification_filter_required_query_plan_count, searchIndexContract.summary.search_index_query_plan_count);
      assert.equal(dashboard.summary.search_index_policy_snapshot_filter_required_query_plan_count, searchIndexContract.summary.search_index_query_plan_count);
      assert.equal(dashboard.summary.search_index_pre_retrieval_gate_required_query_plan_count, searchIndexContract.summary.search_index_query_plan_count);
      assert.equal(dashboard.summary.search_index_matter_wall_enforced_query_plan_count, searchIndexContract.summary.search_index_query_plan_count);
      assert.equal(dashboard.summary.search_index_classification_enforced_query_plan_count, searchIndexContract.summary.search_index_query_plan_count);
      assert.equal(dashboard.summary.search_index_policy_snapshot_bound_query_plan_count, searchIndexContract.summary.search_index_query_plan_count);
      assert.equal(dashboard.summary.search_index_held_query_plan_count, searchIndexContract.summary.search_index_query_plan_count);
      assert.equal(dashboard.summary.search_index_executable_query_plan_count, 0);
      assert.equal(dashboard.summary.search_index_source_ref_preserved_query_plan_count, searchIndexContract.summary.search_index_query_plan_count);
      assert.equal(dashboard.summary.search_index_validation_error_count, 0);
      assert.equal(dashboard.summary.evidence_contract_freeze_source_span_count, evidenceContractFreeze.summary.source_span_count);
      assert.equal(dashboard.summary.evidence_contract_freeze_evidence_item_count, evidenceContractFreeze.summary.evidence_item_count);
      assert.equal(dashboard.summary.evidence_contract_freeze_fact_claim_count, evidenceContractFreeze.summary.fact_claim_count);
      assert.equal(dashboard.summary.evidence_contract_freeze_issue_count, evidenceContractFreeze.summary.issue_count);
      assert.equal(dashboard.summary.evidence_contract_freeze_citation_count, evidenceContractFreeze.summary.citation_count);
      assert.equal(dashboard.summary.evidence_contract_freeze_lineage_edge_count, evidenceContractFreeze.summary.lineage_edge_count);
      assert.equal(dashboard.summary.evidence_contract_freeze_citation_bound_count, evidenceContractFreeze.summary.citation_bound_count);
      assert.equal(dashboard.summary.evidence_contract_freeze_citation_broken_count, 0);
      assert.equal(dashboard.summary.evidence_contract_freeze_complete_lineage_path_count, evidenceContractFreeze.summary.complete_lineage_path_count);
      assert.equal(dashboard.summary.evidence_contract_freeze_broken_lineage_path_count, 0);
      assert.equal(dashboard.summary.evidence_contract_freeze_resource_linked_source_span_count, evidenceContractFreeze.summary.resource_linked_source_span_count);
      assert.equal(dashboard.summary.evidence_contract_freeze_matter_linked_evidence_count, evidenceContractFreeze.summary.matter_linked_evidence_count);
      assert.equal(dashboard.summary.evidence_contract_freeze_policy_snapshot_linked_evidence_count, evidenceContractFreeze.summary.policy_snapshot_linked_evidence_count);
      assert.equal(dashboard.summary.evidence_contract_freeze_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.evidence_contract_freeze_validation_error_count, 0);
      assert.equal(dashboard.summary.capability_workflow_contract_freeze_capability_manifest_count, capabilityWorkflowContractFreeze.summary.capability_manifest_count);
      assert.equal(dashboard.summary.capability_workflow_contract_freeze_workflow_count, capabilityWorkflowContractFreeze.summary.workflow_count);
      assert.equal(dashboard.summary.capability_workflow_contract_freeze_workflow_run_count, capabilityWorkflowContractFreeze.summary.workflow_run_count);
      assert.equal(dashboard.summary.capability_workflow_contract_freeze_agent_run_count, capabilityWorkflowContractFreeze.summary.agent_run_count);
      assert.equal(dashboard.summary.capability_workflow_contract_freeze_capability_io_contract_count, capabilityWorkflowContractFreeze.summary.capability_io_contract_count);
      assert.equal(dashboard.summary.capability_workflow_contract_freeze_gate_runtime_contract_count, capabilityWorkflowContractFreeze.summary.gate_runtime_contract_count);
      assert.equal(dashboard.summary.capability_workflow_contract_freeze_workflow_execution_binding_count, capabilityWorkflowContractFreeze.summary.workflow_execution_binding_count);
      assert.equal(dashboard.summary.capability_workflow_contract_freeze_capability_with_input_output_count, capabilityWorkflowContractFreeze.summary.capability_with_input_output_count);
      assert.equal(dashboard.summary.capability_workflow_contract_freeze_capability_with_gate_contract_count, capabilityWorkflowContractFreeze.summary.capability_with_gate_contract_count);
      assert.equal(dashboard.summary.capability_workflow_contract_freeze_capability_with_runtime_contract_count, capabilityWorkflowContractFreeze.summary.capability_with_runtime_contract_count);
      assert.equal(dashboard.summary.capability_workflow_contract_freeze_workflow_linked_capability_count, capabilityWorkflowContractFreeze.summary.workflow_linked_capability_count);
      assert.equal(dashboard.summary.capability_workflow_contract_freeze_workflow_run_linked_workflow_count, capabilityWorkflowContractFreeze.summary.workflow_run_linked_workflow_count);
      assert.equal(dashboard.summary.capability_workflow_contract_freeze_agent_run_linked_workflow_run_count, capabilityWorkflowContractFreeze.summary.agent_run_linked_workflow_run_count);
      assert.equal(dashboard.summary.capability_workflow_contract_freeze_runtime_binding_count, capabilityWorkflowContractFreeze.summary.runtime_binding_count);
      assert.equal(dashboard.summary.capability_workflow_contract_freeze_runtime_binding_allowed_count, capabilityWorkflowContractFreeze.summary.runtime_binding_allowed_count);
      assert.equal(dashboard.summary.capability_workflow_contract_freeze_runtime_binding_blocked_count, 0);
      assert.equal(dashboard.summary.capability_workflow_contract_freeze_gate_binding_count, capabilityWorkflowContractFreeze.summary.gate_binding_count);
      assert.equal(dashboard.summary.capability_workflow_contract_freeze_required_field_declared_count, capabilityWorkflowContractFreeze.summary.required_field_declared_count);
      assert.equal(dashboard.summary.capability_workflow_contract_freeze_optional_field_declared_count, capabilityWorkflowContractFreeze.summary.optional_field_declared_count);
      assert.equal(dashboard.summary.capability_workflow_contract_freeze_version_required_count, capabilityWorkflowContractFreeze.summary.version_required_count);
      assert.equal(dashboard.summary.capability_workflow_contract_freeze_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.capability_workflow_contract_freeze_validation_error_count, 0);
      assert.equal(dashboard.summary.runtime_agentrun_contract_freeze_runtime_adapter_count, runtimeAgentRunContractFreeze.summary.runtime_adapter_count);
      assert.equal(dashboard.summary.runtime_agentrun_contract_freeze_runtime_execution_contract_count, runtimeAgentRunContractFreeze.summary.runtime_execution_contract_count);
      assert.equal(dashboard.summary.runtime_agentrun_contract_freeze_used_runtime_count, runtimeAgentRunContractFreeze.summary.used_runtime_count);
      assert.equal(dashboard.summary.runtime_agentrun_contract_freeze_agent_run_count, runtimeAgentRunContractFreeze.summary.agent_run_count);
      assert.equal(dashboard.summary.runtime_agentrun_contract_freeze_runtime_output_count, runtimeAgentRunContractFreeze.summary.runtime_output_count);
      assert.equal(dashboard.summary.runtime_agentrun_contract_freeze_runtime_log_count, runtimeAgentRunContractFreeze.summary.runtime_log_count);
      assert.equal(dashboard.summary.runtime_agentrun_contract_freeze_runtime_artifact_count, runtimeAgentRunContractFreeze.summary.runtime_artifact_count);
      assert.equal(dashboard.summary.runtime_agentrun_contract_freeze_runtime_verification_count, runtimeAgentRunContractFreeze.summary.runtime_verification_count);
      assert.equal(dashboard.summary.runtime_agentrun_contract_freeze_risk_declared_count, runtimeAgentRunContractFreeze.summary.risk_declared_count);
      assert.equal(dashboard.summary.runtime_agentrun_contract_freeze_verification_flag_declared_count, runtimeAgentRunContractFreeze.summary.verification_flag_declared_count);
      assert.equal(dashboard.summary.runtime_agentrun_contract_freeze_log_required_agent_run_count, runtimeAgentRunContractFreeze.summary.log_required_agent_run_count);
      assert.equal(dashboard.summary.runtime_agentrun_contract_freeze_agent_log_bound_count, runtimeAgentRunContractFreeze.summary.agent_log_bound_count);
      assert.equal(dashboard.summary.runtime_agentrun_contract_freeze_output_hash_count, runtimeAgentRunContractFreeze.summary.output_hash_count);
      assert.equal(dashboard.summary.runtime_agentrun_contract_freeze_artifact_capture_required_agent_run_count, runtimeAgentRunContractFreeze.summary.artifact_capture_required_agent_run_count);
      assert.equal(dashboard.summary.runtime_agentrun_contract_freeze_artifact_capture_bound_count, runtimeAgentRunContractFreeze.summary.artifact_capture_bound_count);
      assert.equal(dashboard.summary.runtime_agentrun_contract_freeze_high_risk_agent_run_count, runtimeAgentRunContractFreeze.summary.high_risk_agent_run_count);
      assert.equal(dashboard.summary.runtime_agentrun_contract_freeze_untrusted_output_agent_run_count, runtimeAgentRunContractFreeze.summary.untrusted_output_agent_run_count);
      assert.equal(dashboard.summary.runtime_agentrun_contract_freeze_verification_required_agent_run_count, runtimeAgentRunContractFreeze.summary.verification_required_agent_run_count);
      assert.equal(dashboard.summary.runtime_agentrun_contract_freeze_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.runtime_agentrun_contract_freeze_validation_error_count, 0);
      assert.equal(dashboard.summary.gate_approval_contract_freeze_gate_result_count, gateApprovalContractFreeze.summary.gate_result_count);
      assert.equal(dashboard.summary.gate_approval_contract_freeze_approval_request_count, gateApprovalContractFreeze.summary.approval_request_count);
      assert.equal(dashboard.summary.gate_approval_contract_freeze_approval_decision_count, gateApprovalContractFreeze.summary.approval_decision_count);
      assert.equal(dashboard.summary.gate_approval_contract_freeze_human_gate_contract_count, gateApprovalContractFreeze.summary.human_gate_contract_count);
      assert.equal(dashboard.summary.gate_approval_contract_freeze_human_approval_gate_count, gateApprovalContractFreeze.summary.human_approval_gate_count);
      assert.equal(dashboard.summary.gate_approval_contract_freeze_human_approval_gate_linked_count, gateApprovalContractFreeze.summary.human_approval_gate_linked_count);
      assert.equal(dashboard.summary.gate_approval_contract_freeze_gate_approval_binding_count, gateApprovalContractFreeze.summary.gate_approval_binding_count);
      assert.equal(dashboard.summary.gate_approval_contract_freeze_linked_gate_approval_binding_count, gateApprovalContractFreeze.summary.linked_gate_approval_binding_count);
      assert.equal(dashboard.summary.gate_approval_contract_freeze_output_approval_request_count, gateApprovalContractFreeze.summary.output_approval_request_count);
      assert.equal(dashboard.summary.gate_approval_contract_freeze_gate_blocker_review_count, gateApprovalContractFreeze.summary.gate_blocker_review_count);
      assert.equal(dashboard.summary.gate_approval_contract_freeze_evidence_review_request_count, gateApprovalContractFreeze.summary.evidence_review_request_count);
      assert.equal(dashboard.summary.gate_approval_contract_freeze_protected_explicit_approval_request_count, 0);
      assert.equal(dashboard.summary.gate_approval_contract_freeze_approval_authority_declared_count, gateApprovalContractFreeze.summary.approval_authority_declared_count);
      assert.equal(dashboard.summary.gate_approval_contract_freeze_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.gate_approval_contract_freeze_validation_error_count, 0);
      assert.equal(dashboard.summary.output_delivery_contract_freeze_output_artifact_count, outputDeliveryContractFreeze.summary.output_artifact_count);
      assert.equal(dashboard.summary.output_delivery_contract_freeze_delivery_action_count, outputDeliveryContractFreeze.summary.delivery_action_count);
      assert.equal(dashboard.summary.output_delivery_contract_freeze_delivery_receipt_count, outputDeliveryContractFreeze.summary.delivery_receipt_count);
      assert.equal(dashboard.summary.output_delivery_contract_freeze_output_delivery_binding_count, outputDeliveryContractFreeze.summary.output_delivery_binding_count);
      assert.equal(dashboard.summary.output_delivery_contract_freeze_delivery_state_transition_count, outputDeliveryContractFreeze.summary.delivery_state_transition_count);
      assert.equal(dashboard.summary.output_delivery_contract_freeze_artifact_hash_count, outputDeliveryContractFreeze.summary.artifact_hash_count);
      assert.equal(dashboard.summary.output_delivery_contract_freeze_missing_artifact_hash_count, 0);
      assert.equal(dashboard.summary.output_delivery_contract_freeze_linked_delivery_action_count, outputDeliveryContractFreeze.summary.linked_delivery_action_count);
      assert.equal(dashboard.summary.output_delivery_contract_freeze_missing_delivery_action_count, 0);
      assert.equal(dashboard.summary.output_delivery_contract_freeze_pending_approval_artifact_count, outputDeliveryContractFreeze.summary.pending_approval_artifact_count);
      assert.equal(dashboard.summary.output_delivery_contract_freeze_approval_request_linked_artifact_count, outputDeliveryContractFreeze.summary.approval_request_linked_artifact_count);
      assert.equal(dashboard.summary.output_delivery_contract_freeze_protected_delivery_action_count, outputDeliveryContractFreeze.summary.protected_delivery_action_count);
      assert.equal(dashboard.summary.output_delivery_contract_freeze_delivered_receipt_count, outputDeliveryContractFreeze.summary.delivered_receipt_count);
      assert.equal(dashboard.summary.output_delivery_contract_freeze_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.output_delivery_contract_freeze_validation_error_count, 0);
      assert.equal(dashboard.summary.event_audit_run_contract_freeze_event_record_count, eventAuditRunContractFreeze.summary.event_record_count);
      assert.equal(dashboard.summary.event_audit_run_contract_freeze_audit_event_count, eventAuditRunContractFreeze.summary.audit_event_count);
      assert.equal(dashboard.summary.event_audit_run_contract_freeze_run_ledger_count, eventAuditRunContractFreeze.summary.run_ledger_count);
      assert.equal(dashboard.summary.event_audit_run_contract_freeze_event_run_binding_count, eventAuditRunContractFreeze.summary.event_run_binding_count);
      assert.equal(dashboard.summary.event_audit_run_contract_freeze_linked_event_run_binding_count, eventAuditRunContractFreeze.summary.linked_event_run_binding_count);
      assert.equal(dashboard.summary.event_audit_run_contract_freeze_external_audit_event_count, eventAuditRunContractFreeze.summary.external_audit_event_count);
      assert.equal(dashboard.summary.event_audit_run_contract_freeze_missing_event_run_binding_count, 0);
      assert.equal(dashboard.summary.event_audit_run_contract_freeze_correlation_id_count, eventAuditRunContractFreeze.summary.correlation_id_count);
      assert.equal(dashboard.summary.event_audit_run_contract_freeze_missing_correlation_id_count, 0);
      assert.equal(dashboard.summary.event_audit_run_contract_freeze_actor_declared_count, eventAuditRunContractFreeze.summary.actor_declared_count);
      assert.equal(dashboard.summary.event_audit_run_contract_freeze_missing_actor_count, 0);
      assert.equal(dashboard.summary.event_audit_run_contract_freeze_policy_snapshot_declared_count, eventAuditRunContractFreeze.summary.policy_snapshot_declared_count);
      assert.equal(dashboard.summary.event_audit_run_contract_freeze_fallback_policy_snapshot_count, eventAuditRunContractFreeze.summary.fallback_policy_snapshot_count);
      assert.equal(dashboard.summary.event_audit_run_contract_freeze_missing_policy_snapshot_count, 0);
      assert.equal(dashboard.summary.event_audit_run_contract_freeze_source_schema_version_declared_count, eventAuditRunContractFreeze.summary.source_schema_version_declared_count);
      assert.equal(dashboard.summary.event_audit_run_contract_freeze_run_with_event_count, eventAuditRunContractFreeze.summary.run_with_event_count);
      assert.equal(dashboard.summary.event_audit_run_contract_freeze_run_with_agent_count, eventAuditRunContractFreeze.summary.run_with_agent_count);
      assert.equal(dashboard.summary.event_audit_run_contract_freeze_run_with_policy_snapshot_count, eventAuditRunContractFreeze.summary.run_with_policy_snapshot_count);
      assert.equal(dashboard.summary.event_audit_run_contract_freeze_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.event_audit_run_contract_freeze_validation_error_count, 0);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_error_record_count, errorCostObservabilityContractFreeze.summary.error_record_count);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_run_blocked_error_count, errorCostObservabilityContractFreeze.summary.run_blocked_error_count);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_gate_failed_error_count, errorCostObservabilityContractFreeze.summary.gate_failed_error_count);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_retryable_error_count, errorCostObservabilityContractFreeze.summary.retryable_error_count);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_blocking_error_count, errorCostObservabilityContractFreeze.summary.blocking_error_count);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_cost_observation_count, errorCostObservabilityContractFreeze.summary.cost_observation_count);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_token_usage_linked_count, errorCostObservabilityContractFreeze.summary.token_usage_linked_count);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_missing_token_usage_count, 0);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_cost_attribution_linked_count, errorCostObservabilityContractFreeze.summary.cost_attribution_linked_count);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_budget_alert_linked_count, errorCostObservabilityContractFreeze.summary.budget_alert_linked_count);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_over_budget_count, 0);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_untracked_cost_count, 0);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_total_projected_usd, errorCostObservabilityContractFreeze.summary.total_projected_usd);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_total_observed_usd, errorCostObservabilityContractFreeze.summary.total_observed_usd);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_total_estimated_token_usd, errorCostObservabilityContractFreeze.summary.total_estimated_token_usd);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_total_token_count, errorCostObservabilityContractFreeze.summary.total_token_count);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_trace_projection_count, errorCostObservabilityContractFreeze.summary.trace_projection_count);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_trace_with_error_count, errorCostObservabilityContractFreeze.summary.trace_with_error_count);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_trace_with_cost_count, errorCostObservabilityContractFreeze.summary.trace_with_cost_count);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_trace_with_policy_snapshot_count, errorCostObservabilityContractFreeze.summary.trace_with_policy_snapshot_count);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_latency_observed_count, errorCostObservabilityContractFreeze.summary.latency_observed_count);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_missing_latency_count, 0);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_total_runtime_seconds, errorCostObservabilityContractFreeze.summary.total_runtime_seconds);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_average_latency_seconds, errorCostObservabilityContractFreeze.summary.average_latency_seconds);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_retry_projection_count, errorCostObservabilityContractFreeze.summary.retry_projection_count);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_retry_count, errorCostObservabilityContractFreeze.summary.retry_count);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_trace_with_retry_count, errorCostObservabilityContractFreeze.summary.trace_with_retry_count);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_failed_validation_item_count, 0);
      assert.equal(dashboard.summary.error_cost_observability_contract_freeze_validation_error_count, 0);
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
      assert.equal(dashboard.summary.human_review_correction_workspace_actor_count, humanReviewCorrectionWorkspace.summary.actor_workspace_count);
      assert.equal(dashboard.summary.human_review_correction_workspace_item_count, humanReviewCorrectionWorkspace.summary.correction_item_count);
      assert.equal(dashboard.summary.human_review_correction_workspace_receipt_row_count, humanReviewCorrectionWorkspace.summary.receipt_row_count);
      assert.equal(dashboard.summary.human_review_correction_workspace_pending_count, humanReviewCorrectionWorkspace.summary.pending_decision_count);
      assert.equal(dashboard.summary.human_review_correction_workspace_correction_count, humanReviewCorrectionWorkspace.summary.needs_correction_count);
      assert.equal(dashboard.summary.human_review_correction_workspace_editable_file_count, humanReviewCorrectionWorkspace.summary.editable_file_count);
      assert.equal(dashboard.summary.human_review_correction_workspace_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_correction_workspace_merge_actor_input_count, humanReviewCorrectionWorkspaceMerge.summary.actor_input_count);
      assert.equal(dashboard.summary.human_review_correction_workspace_merge_receipt_row_count, humanReviewCorrectionWorkspaceMerge.summary.receipt_row_count);
      assert.equal(dashboard.summary.human_review_correction_workspace_merge_pending_count, humanReviewCorrectionWorkspaceMerge.summary.pending_receipt_count);
      assert.equal(dashboard.summary.human_review_correction_workspace_merge_ready_count, 0);
      assert.equal(dashboard.summary.human_review_correction_workspace_merge_missing_count, 0);
      assert.equal(dashboard.summary.human_review_correction_workspace_merge_invalid_count, 0);
      assert.equal(dashboard.summary.human_review_correction_workspace_merge_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_correction_validation_item_count, humanReviewCorrectionValidation.summary.validation_item_count);
      assert.equal(dashboard.summary.human_review_correction_validation_receipt_count, humanReviewCorrectionValidation.summary.receipt_count);
      assert.equal(dashboard.summary.human_review_correction_validation_pending_count, humanReviewCorrectionValidation.summary.pending_receipt_count);
      assert.equal(dashboard.summary.human_review_correction_validation_ready_count, 0);
      assert.equal(dashboard.summary.human_review_correction_validation_missing_count, 0);
      assert.equal(dashboard.summary.human_review_correction_validation_invalid_count, 0);
      assert.equal(dashboard.summary.human_review_correction_validation_unknown_count, 0);
      assert.equal(dashboard.summary.human_review_correction_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_correction_feedback_actor_count, humanReviewCorrectionFeedback.summary.actor_feedback_count);
      assert.equal(dashboard.summary.human_review_correction_feedback_item_count, humanReviewCorrectionFeedback.summary.feedback_item_count);
      assert.equal(dashboard.summary.human_review_correction_feedback_pending_count, humanReviewCorrectionFeedback.summary.pending_receipt_count);
      assert.equal(dashboard.summary.human_review_correction_feedback_ready_count, 0);
      assert.equal(dashboard.summary.human_review_correction_feedback_correction_count, 0);
      assert.equal(dashboard.summary.human_review_correction_feedback_missing_validation_count, 0);
      assert.equal(dashboard.summary.human_review_correction_feedback_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_actor_count, humanReviewCycleLedger.summary.actor_cycle_count);
      assert.equal(dashboard.summary.human_review_cycle_item_count, humanReviewCycleLedger.summary.cycle_item_count);
      assert.equal(dashboard.summary.human_review_cycle_pending_count, humanReviewCycleLedger.summary.pending_human_review_count);
      assert.equal(dashboard.summary.human_review_cycle_ready_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_attention_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_verification_actor_count, humanReviewCycleReceiptCompletionVerification.summary.actor_verification_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_verification_item_count, humanReviewCycleReceiptCompletionVerification.summary.verification_item_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_verification_pending_input_count, humanReviewCycleReceiptCompletionVerification.summary.pending_human_input_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_verification_ready_validation_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_verification_pending_prompt_count, humanReviewCycleReceiptCompletionVerification.summary.pending_prompt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_verification_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_workbench_actor_count, humanReviewCycleReceiptCompletionWorkbench.summary.actor_workbench_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_workbench_item_count, humanReviewCycleReceiptCompletionWorkbench.summary.workbench_item_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_workbench_pending_input_count, humanReviewCycleReceiptCompletionWorkbench.summary.pending_human_input_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_workbench_ready_validation_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_workbench_pending_prompt_count, humanReviewCycleReceiptCompletionWorkbench.summary.pending_prompt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_workbench_template_count, humanReviewCycleReceiptCompletionWorkbench.summary.receipt_completion_template_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_workbench_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_runbook_actor_count, humanReviewCycleReceiptCompletionRunbook.summary.actor_runbook_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_runbook_step_count, humanReviewCycleReceiptCompletionRunbook.summary.runbook_step_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_runbook_pending_input_count, humanReviewCycleReceiptCompletionRunbook.summary.pending_human_input_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_runbook_ready_validation_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_runbook_pending_prompt_count, humanReviewCycleReceiptCompletionRunbook.summary.pending_prompt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_runbook_command_step_count, humanReviewCycleReceiptCompletionRunbook.summary.command_step_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_runbook_manual_step_count, humanReviewCycleReceiptCompletionRunbook.summary.manual_step_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_runbook_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_readiness_actor_count, humanReviewCycleReceiptCompletionReadiness.summary.actor_readiness_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_readiness_command_gate_count, humanReviewCycleReceiptCompletionReadiness.summary.command_gate_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_readiness_manual_requirement_count, humanReviewCycleReceiptCompletionReadiness.summary.manual_requirement_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_readiness_allowed_command_count, humanReviewCycleReceiptCompletionReadiness.summary.allowed_command_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_readiness_blocked_command_count, humanReviewCycleReceiptCompletionReadiness.summary.blocked_command_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_readiness_blocked_until_manual_input_count, humanReviewCycleReceiptCompletionReadiness.summary.blocked_until_manual_input_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_readiness_protected_command_count, humanReviewCycleReceiptCompletionReadiness.summary.protected_command_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_readiness_manual_input_required_count, humanReviewCycleReceiptCompletionReadiness.summary.manual_input_required_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_readiness_pending_input_count, humanReviewCycleReceiptCompletionReadiness.summary.pending_human_input_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_readiness_pending_prompt_count, humanReviewCycleReceiptCompletionReadiness.summary.pending_prompt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_readiness_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_ready_count, humanReviewCycleReceiptCompletionCommandQueue.summary.command_queue_item_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_held_count, humanReviewCycleReceiptCompletionCommandQueue.summary.held_command_item_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_actor_count, humanReviewCycleReceiptCompletionCommandQueue.summary.actor_command_queue_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_protected_held_count, humanReviewCycleReceiptCompletionCommandQueue.summary.protected_held_command_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_manual_hold_count, humanReviewCycleReceiptCompletionCommandQueue.summary.manual_input_hold_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_pending_input_count, humanReviewCycleReceiptCompletionCommandQueue.summary.pending_human_input_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_pending_prompt_count, humanReviewCycleReceiptCompletionCommandQueue.summary.pending_prompt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipts_requirement_count, humanReviewCycleReceiptCompletionCommandReceipts.summary.receipt_requirement_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipts_draft_count, humanReviewCycleReceiptCompletionCommandReceipts.summary.receipt_draft_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipts_pending_count, humanReviewCycleReceiptCompletionCommandReceipts.summary.pending_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipts_command_count, humanReviewCycleReceiptCompletionCommandReceipts.summary.command_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipts_held_reference_count, humanReviewCycleReceiptCompletionCommandReceipts.summary.held_command_reference_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipts_protected_held_count, humanReviewCycleReceiptCompletionCommandReceipts.summary.protected_held_command_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipts_required_field_count, humanReviewCycleReceiptCompletionCommandReceipts.summary.required_field_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipts_source_ready_count, humanReviewCycleReceiptCompletionCommandReceipts.summary.source_ready_command_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipts_source_held_count, humanReviewCycleReceiptCompletionCommandReceipts.summary.source_held_command_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipts_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_validation_item_count, humanReviewCycleReceiptCompletionCommandReceiptValidation.summary.validation_item_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_validation_receipt_count, humanReviewCycleReceiptCompletionCommandReceiptValidation.summary.receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_validation_ready_count, humanReviewCycleReceiptCompletionCommandReceiptValidation.summary.ready_to_confirm_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_validation_pending_count, humanReviewCycleReceiptCompletionCommandReceiptValidation.summary.pending_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_validation_missing_count, humanReviewCycleReceiptCompletionCommandReceiptValidation.summary.missing_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_validation_invalid_count, humanReviewCycleReceiptCompletionCommandReceiptValidation.summary.invalid_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_validation_unknown_count, humanReviewCycleReceiptCompletionCommandReceiptValidation.summary.unknown_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_feedback_actor_count, humanReviewCycleReceiptCompletionCommandReceiptFeedback.summary.actor_feedback_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_feedback_item_count, humanReviewCycleReceiptCompletionCommandReceiptFeedback.summary.feedback_item_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_feedback_pending_count, humanReviewCycleReceiptCompletionCommandReceiptFeedback.summary.pending_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_feedback_ready_count, humanReviewCycleReceiptCompletionCommandReceiptFeedback.summary.ready_for_confirmation_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_feedback_correction_count, humanReviewCycleReceiptCompletionCommandReceiptFeedback.summary.needs_correction_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_feedback_invalid_count, humanReviewCycleReceiptCompletionCommandReceiptFeedback.summary.invalid_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_feedback_missing_count, humanReviewCycleReceiptCompletionCommandReceiptFeedback.summary.missing_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_feedback_unknown_count, humanReviewCycleReceiptCompletionCommandReceiptFeedback.summary.unknown_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_feedback_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_actor_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspace.summary.actor_workspace_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_item_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspace.summary.workspace_item_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_receipt_row_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspace.summary.receipt_row_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_pending_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspace.summary.pending_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_correction_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspace.summary.needs_correction_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_ready_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspace.summary.ready_for_confirmation_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_editable_file_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspace.summary.editable_file_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_merge_actor_input_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.summary.actor_input_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_merge_available_actor_input_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.summary.available_actor_input_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_merge_item_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.summary.merge_item_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_merge_receipt_row_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.summary.receipt_row_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_merge_pending_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.summary.pending_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_merge_ready_validation_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.summary.ready_for_validation_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_merge_missing_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.summary.missing_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_merge_duplicate_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceMerge.summary.duplicate_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_merge_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_validation_item_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidation.summary.validation_item_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_validation_receipt_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidation.summary.receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_validation_pending_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidation.summary.pending_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_validation_ready_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidation.summary.ready_to_confirm_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_validation_invalid_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidation.summary.invalid_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_validation_missing_count, humanReviewCycleReceiptCompletionCommandReceiptWorkspaceValidation.summary.missing_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_workspace_validation_error_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_application_ready_count, humanReviewCycleReceiptCompletionCommandReceiptApplication.summary.ready_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_application_pending_count, humanReviewCycleReceiptCompletionCommandReceiptApplication.summary.pending_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_application_invalid_count, humanReviewCycleReceiptCompletionCommandReceiptApplication.summary.invalid_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_application_applied_count, humanReviewCycleReceiptCompletionCommandReceiptApplication.summary.applied_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_application_patched_queue_count, humanReviewCycleReceiptCompletionCommandReceiptApplication.summary.patched_command_queue_item_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_application_audit_event_count, humanReviewCycleReceiptCompletionCommandReceiptApplication.summary.audit_event_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_application_error_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_application_refresh_executed_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_receipt_application_protected_executed_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_reconciliation_item_count, humanReviewCycleReceiptCompletionReconciliation.summary.reconciliation_item_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_reconciliation_actor_count, humanReviewCycleReceiptCompletionReconciliation.summary.actor_status_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_reconciliation_pending_command_receipt_count, humanReviewCycleReceiptCompletionReconciliation.summary.pending_command_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_reconciliation_applied_command_receipt_count, humanReviewCycleReceiptCompletionReconciliation.summary.applied_command_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_reconciliation_held_command_count, humanReviewCycleReceiptCompletionReconciliation.summary.held_command_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_reconciliation_protected_held_count, humanReviewCycleReceiptCompletionReconciliation.summary.protected_held_command_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_reconciliation_blocked_follow_on_count, humanReviewCycleReceiptCompletionReconciliation.summary.blocked_follow_on_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_reconciliation_error_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_reconciliation_refresh_executed_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_reconciliation_protected_executed_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_baseline_blocker_count, humanReviewCycleReceiptCompletionBaseline.summary.blocker_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_baseline_pending_command_receipt_count, humanReviewCycleReceiptCompletionBaseline.summary.pending_command_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_baseline_held_command_count, humanReviewCycleReceiptCompletionBaseline.summary.held_command_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_baseline_protected_hold_count, humanReviewCycleReceiptCompletionBaseline.summary.protected_hold_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_baseline_mismatched_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_baseline_error_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_baseline_refresh_executed_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_baseline_protected_executed_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_manual_command_receipt_pack_actor_count, humanReviewCycleReceiptCompletionManualCommandReceiptPack.summary.actor_receipt_pack_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_manual_command_receipt_pack_item_count, humanReviewCycleReceiptCompletionManualCommandReceiptPack.summary.receipt_pack_item_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_manual_command_receipt_pack_pending_blocker_count, humanReviewCycleReceiptCompletionManualCommandReceiptPack.summary.pending_command_receipt_blocker_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_manual_command_receipt_pack_non_receipt_blocker_count, humanReviewCycleReceiptCompletionManualCommandReceiptPack.summary.non_receipt_blocker_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_manual_command_receipt_pack_missing_required_field_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_manual_command_receipt_pack_error_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_manual_command_receipt_pack_refresh_executed_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_manual_command_receipt_pack_protected_executed_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_held_command_resolution_plan_count, humanReviewCycleReceiptCompletionHeldCommandResolution.summary.resolution_plan_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_held_command_resolution_actor_count, humanReviewCycleReceiptCompletionHeldCommandResolution.summary.actor_resolution_plan_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_held_command_resolution_manual_input_count, humanReviewCycleReceiptCompletionHeldCommandResolution.summary.manual_input_resolution_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_held_command_resolution_protected_count, humanReviewCycleReceiptCompletionHeldCommandResolution.summary.protected_resolution_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_held_command_resolution_unblock_condition_count, humanReviewCycleReceiptCompletionHeldCommandResolution.summary.unblock_condition_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_held_command_resolution_follow_on_action_count, humanReviewCycleReceiptCompletionHeldCommandResolution.summary.follow_on_action_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_held_command_resolution_missing_actor_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_held_command_resolution_missing_unblock_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_held_command_resolution_missing_follow_on_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_held_command_resolution_error_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_held_command_resolution_refresh_executed_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_held_command_resolution_protected_executed_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_protected_approval_request_count, humanReviewCycleReceiptCompletionProtectedApprovalRequestPack.summary.approval_request_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_protected_approval_actor_count, humanReviewCycleReceiptCompletionProtectedApprovalRequestPack.summary.actor_approval_pack_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_protected_approval_pending_count, humanReviewCycleReceiptCompletionProtectedApprovalRequestPack.summary.pending_explicit_approval_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_protected_approval_source_protected_count, humanReviewCycleReceiptCompletionHeldCommandResolution.summary.protected_resolution_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_protected_approval_request_protected_count, humanReviewCycleReceiptCompletionProtectedApprovalRequestPack.summary.protected_action_request_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_protected_approval_mixed_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_protected_approval_non_protected_request_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_protected_approval_missing_target_path_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_protected_approval_missing_required_field_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_protected_approval_error_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_protected_approval_refresh_executed_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_protected_approval_protected_executed_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_manual_revalidation_item_count, humanReviewCycleReceiptCompletionManualRevalidation.summary.revalidation_item_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_manual_revalidation_source_pack_item_count, humanReviewCycleReceiptCompletionManualRevalidation.summary.source_pack_item_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_manual_revalidation_actor_count, humanReviewCycleReceiptCompletionManualRevalidation.summary.actor_revalidation_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_manual_revalidation_pending_count, humanReviewCycleReceiptCompletionManualRevalidation.summary.pending_human_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_manual_revalidation_ready_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_manual_revalidation_applied_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_manual_revalidation_candidate_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_manual_revalidation_non_human_candidate_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_manual_revalidation_protected_overlap_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_manual_revalidation_auto_executed_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_manual_revalidation_error_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_manual_revalidation_refresh_executed_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_manual_revalidation_protected_executed_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_patch_projection_item_count, humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.projection_item_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_patch_projection_source_revalidation_item_count, humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.source_revalidation_item_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_patch_projection_target_count, humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.patch_target_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_patch_projection_ready_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_patch_projection_waiting_count, humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.waiting_patch_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_patch_projection_blocked_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_patch_projection_operation_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_patch_projection_audit_candidate_count, humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.audit_event_candidate_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_patch_projection_emittable_audit_candidate_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_patch_projection_missing_target_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_patch_projection_non_human_candidate_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_patch_projection_protected_overlap_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_patch_projection_auto_executed_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_patch_projection_error_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_patch_projection_applied_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_patch_projection_emitted_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_patch_projection_command_executed_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_patch_projection_refresh_executed_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_command_queue_patch_projection_protected_executed_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_closeout_item_count, humanReviewCycleReceiptCompletionCloseoutLedger.summary.closeout_item_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_closeout_source_baseline_blocker_count, humanReviewCycleReceiptCompletionBaseline.summary.blocker_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_closeout_actor_count, humanReviewCycleReceiptCompletionCloseoutLedger.summary.actor_closeout_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_closeout_pending_count, humanReviewCycleReceiptCompletionCloseoutLedger.summary.pending_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_closeout_approved_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_closeout_rejected_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_closeout_superseded_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_closeout_normalized_total_count, humanReviewCycleReceiptCompletionCloseoutLedger.summary.closeout_item_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_closeout_unknown_status_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_closeout_pending_command_receipt_count, humanReviewCycleReceiptCompletionBaseline.summary.pending_command_receipt_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_closeout_pending_held_command_count, humanReviewCycleReceiptCompletionBaseline.summary.held_command_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_closeout_pending_protected_approval_count, humanReviewCycleReceiptCompletionProtectedApprovalRequestPack.summary.pending_explicit_approval_count);
      assert.equal(dashboard.summary.human_review_cycle_completion_closeout_error_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_closeout_patch_applied_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_closeout_emitted_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_closeout_command_executed_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_closeout_refresh_executed_count, 0);
      assert.equal(dashboard.summary.human_review_cycle_completion_closeout_protected_executed_count, 0);
      assert.equal(dashboard.summary.human_review_v1_freeze_required_source_count, humanReviewV1RegressionFreeze.summary.required_source_count);
      assert.equal(dashboard.summary.human_review_v1_freeze_available_required_source_count, humanReviewV1RegressionFreeze.summary.available_required_source_count);
      assert.equal(dashboard.summary.human_review_v1_freeze_artifact_count, humanReviewV1RegressionFreeze.summary.regression_fixture_artifact_count);
      assert.equal(dashboard.summary.human_review_v1_freeze_content_hash_count, humanReviewV1RegressionFreeze.summary.regression_fixture_hash_count);
      assert.equal(dashboard.summary.human_review_v1_freeze_verification_checkpoint_count, humanReviewV1RegressionFreeze.summary.verification_checkpoint_count);
      assert.equal(dashboard.summary.human_review_v1_freeze_failed_checkpoint_count, 0);
      assert.equal(dashboard.summary.human_review_v1_freeze_loop_failed_count, 0);
      assert.equal(dashboard.summary.human_review_v1_freeze_loop_missing_artifact_count, 0);
      assert.equal(dashboard.summary.human_review_v1_freeze_closeout_item_count, humanReviewCycleReceiptCompletionCloseoutLedger.summary.closeout_item_count);
      assert.equal(dashboard.summary.human_review_v1_freeze_pending_count, humanReviewCycleReceiptCompletionCloseoutLedger.summary.pending_count);
      assert.equal(dashboard.summary.human_review_v1_freeze_unknown_status_count, 0);
      assert.equal(dashboard.summary.human_review_v1_freeze_error_count, 0);
      assert.equal(dashboard.summary.human_review_v1_freeze_command_executed_count, 0);
      assert.equal(dashboard.summary.human_review_v1_freeze_patch_applied_count, 0);
      assert.equal(dashboard.summary.human_review_v1_freeze_emitted_count, 0);
      assert.equal(dashboard.summary.human_review_v1_freeze_protected_executed_count, 0);
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
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "matter_tagging_decision_ledger"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "access_audit_projection"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "store_policy_adapter"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "conflict_check_interface"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "personal_workspace_boundary"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "context_packet_ledger"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "model_routing_ledger"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "model_policy_enforcement"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "tool_runtime_policy_enforcement"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "output_destination_policy_enforcement"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "approval_authority_ledger"));
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
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "contract_inventory"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "contract_dependency_map"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "identity_model"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "resource_contract_freeze"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "matter_contract_freeze"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "client_counterparty_registry"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "matter_profile_team_ledger"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "wall_policy_contract"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "matter_access_policy_evaluator"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "policy_contract_freeze"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "data_classification_rule_engine"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "store_policy_adapter"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "conflict_check_interface"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "personal_workspace_boundary"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "resource_store_interface"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "immutable_object_store_layout"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "resource_version_ledger"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "normalized_text_contract"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "extractor_adapter_contract"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "source_span_store"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "evidence_item_store"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "fact_claim_store"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "issue_graph_store"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "citation_object_store"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "lineage_graph_builder"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "evidence_coverage_score"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "evidence_flags"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "exhibit_map"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "chain_of_custody_events"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "search_index_contract"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "evidence_contract_freeze"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "capability_workflow_contract_freeze"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "runtime_agentrun_contract_freeze"));
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
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_correction_workspace"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_correction_workspace_merge"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_correction_validation"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_correction_feedback"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_ledger"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_work_orders"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_target_audit"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_triage_inbox"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_reviewer_console"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_receipt_field_audit"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_receipt_completion_pack"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_receipt_completion_verification"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_receipt_completion_workbench"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_receipt_completion_runbook"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_receipt_completion_readiness"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_receipt_completion_command_queue"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_receipt_completion_command_receipts"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_receipt_completion_command_receipt_validation"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_receipt_completion_command_receipt_feedback"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_receipt_completion_command_receipt_workspace"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_receipt_completion_command_receipt_workspace_merge"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_receipt_completion_command_receipt_workspace_validation"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_receipt_completion_command_receipt_application"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_receipt_completion_reconciliation"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_receipt_completion_baseline"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_receipt_completion_manual_command_receipt_pack"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_receipt_completion_held_command_resolution"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_receipt_completion_protected_approval_request_pack"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_receipt_completion_manual_revalidation"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_receipt_completion_command_queue_patch_projection"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_cycle_receipt_completion_closeout_ledger"));
      assert.ok(dashboard.stage_statuses.some((stage) => stage.stage_id === "human_review_v1_regression_freeze"));
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
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/resource-contract-freezes"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/resource-v2-contracts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/resource-version-v2-contracts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/resource-contract-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/resource-store-interfaces"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/resource-store-records"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/resource-version-store-records"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/resource-store-adapter-bindings"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/resource-store-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/immutable-object-store-layouts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/object-path-resolvers"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/raw-source-object-paths"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/generated-output-object-paths"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/object-store-collisions"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/object-store-layout-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/resource-version-ledgers"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/resource-version-families"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/resource-version-events"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/resource-version-transitions"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/resource-duplicate-candidates"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/resource-version-object-bindings"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/resource-version-ledger-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/normalized-text-contracts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/normalized-text-artifacts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/normalized-text-location-maps"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/normalized-source-span-seeds"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/normalized-text-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/extractor-adapter-contracts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/extractor-adapters"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/extractor-io-contracts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/extractor-document-type-bindings"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/ocr-fallback-policies"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/extractor-normalized-text-bindings"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/extractor-adapter-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/source-span-stores"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/source-spans"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/source-span-locators"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/source-span-location-units"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/source-span-indexes"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/source-span-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/evidence-item-stores"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/evidence-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/evidence-source-span-bindings"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/evidence-review-queue"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/evidence-item-indexes"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/evidence-item-store-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/fact-claim-stores"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/fact-claims"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/fact-evidence-bindings"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/fact-review-queue"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/fact-claim-indexes"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/fact-claim-store-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/issue-graph-stores"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/issues"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/fact-issue-bindings"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/legal-rules"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/issue-legal-rule-bindings"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/risk-severity-assessments"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/issue-review-queue"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/issue-graph-indexes"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/issue-graph-store-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/citation-object-stores"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/output-paragraphs"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/citations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/paragraph-source-bindings"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/citation-review-queue"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/citation-indexes"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/citation-object-store-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/lineage-graphs"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/lineage-nodes"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/lineage-edges"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/lineage-paths"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/lineage-indexes"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/lineage-graph-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/evidence-coverage-scores"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/evidence-coverage-records"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/evidence-coverage-dimensions"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/evidence-coverage-indexes"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/evidence-coverage-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/evidence-flags"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/evidence-flag-records"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/evidence-flag-decisions"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/evidence-flag-indexes"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/evidence-flag-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/exhibit-maps"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/exhibit-records"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/exhibit-bindings"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/exhibit-indexes"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/exhibit-map-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/custody-event-ledgers"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/custody-events"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/custody-event-links"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/custody-stage-indexes"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/custody-event-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/search-index-contracts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/search-index-manifests"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/search-index-fields"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/search-index-query-plans"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/search-index-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/matter-contract-freezes"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/client-v2-contracts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/party-v2-contracts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/matter-v2-contracts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/matter-team-v2-contracts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/matter-boundary-v2-contracts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/matter-contract-validations"));
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
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/policy-snapshot-binding-ledgers"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/workflow-policy-bindings"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/agent-run-policy-bindings"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/event-policy-bindings"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/gate-policy-bindings"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/approval-policy-bindings"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/output-policy-bindings"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/policy-snapshot-binding-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/policy-contract-freezes"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/data-classification-contracts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/policy-reference-contracts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/policy-decision-contracts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/policy-contract-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/data-classification-rule-engines"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/data-classification-rules"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/resource-classification-decisions"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/classification-policy-bindings"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/data-classification-rule-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/matter-tagging-ledgers"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/matter-tagging-decisions"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/matter-tagging-candidates"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/matter-tagging-confirmations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/matter-tagging-corrections"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/matter-tagging-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/access-audit-projections"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/access-audit-records"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/access-audit-actor-rollups"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/access-audit-resource-rollups"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/access-audit-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/store-policy-adapters"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/store-policy-rules"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/rls-filter-templates"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/store-query-plans"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/store-enforcement-probes"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/store-policy-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/conflict-check-interfaces"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/conflict-check-requests"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/conflict-check-results"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/conflict-check-signals"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/conflict-check-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/personal-workspace-boundaries"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/workspace-boundaries"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/tenant-policy-boundaries"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/search-namespace-policies"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/cross-workspace-probes"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/personal-workspace-boundary-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/output-delivery-contract-freezes"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/output-artifact-v2-contracts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/delivery-action-v2-contracts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/delivery-receipt-v2-contracts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/output-delivery-bindings"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/delivery-state-transitions"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/output-delivery-contract-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/context-packet-ledgers"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/context-packets"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/context-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/context-retrieval-filters"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/model-routing-ledgers"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/model-routing-decisions"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/model-policy-enforcements"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/classification-model-gates"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/resource-model-gates"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/route-model-gates"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/model-policy-enforcement-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/tool-runtime-policy-enforcements"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/runtime-policy-gates"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/tool-permission-gates"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/agent-run-tool-gates"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/tool-runtime-policy-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/output-destination-policy-enforcements"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/policy-destination-rules"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/artifact-destination-gates"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/delivery-action-destination-gates"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/final-action-separation-gates"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/output-destination-policy-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/approval-authority-ledgers"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/authority-policies"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/artifact-authority-decisions"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/approval-request-authority-decisions"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/delivery-action-authority-decisions"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/approval-authority-validations"));
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
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/contract-inventories"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/contract-inventory-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/contract-schemas"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/contract-artifacts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/contract-owner-map"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/contract-dependency-maps"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/contract-dependency-nodes"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/contract-dependency-edges"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/contract-breaking-change-risks"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/contract-owner-dependencies"));
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
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-correction-workspaces"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-correction-actors"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-correction-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-correction-receipt-input"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-correction-workspace-merges"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-correction-merge-actors"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-correction-merge-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-merged-correction-receipt-input"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-correction-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-correction-validation-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-correction-validation-errors"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/validated-correction-human-gate-receipts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-correction-feedbacks"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-correction-feedback-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-correction-actor-feedback"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-ledgers"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-actor-cycles"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-work-orders"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-work-order-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-actor-work-orders"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-target-audits"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-target-audit-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-actor-target-audits"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-triage-inboxes"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-triage-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-actor-triage-inboxes"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-reviewer-consoles"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-console-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-actor-consoles"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-field-audits"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-field-audit-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-actor-field-audits"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-packs"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-actor-completion-packs"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-verifications"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-verification-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-actor-completion-verifications"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-workbenches"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-workbench-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-actor-completion-workbenches"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-runbooks"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-runbook-steps"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-actor-completion-runbooks"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-readiness"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-gates"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-actor-completion-readiness"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-queues"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-queue-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-held-commands"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-actor-completion-command-queues"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-requirements"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-drafts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-held-command-references"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-validation-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-errors"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/validated-human-review-cycle-completion-command-receipts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-feedbacks"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-feedback-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-actor-feedback"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-workspaces"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-workspace-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-actor-workspaces"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-workspace-merges"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-merge-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-actor-inputs"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/merged-human-review-cycle-completion-command-receipt-input"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-workspace-validations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-workspace-validation-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-workspace-validation-errors"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/validated-human-review-cycle-completion-command-workspace-receipts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-applications"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/applied-human-review-cycle-completion-command-receipts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-application-pending-receipts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-receipt-application-audit-events"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-reconciliations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-reconciliation-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-reconciliation-actors"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-baselines"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-baseline-blockers"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-baseline-count-checks"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-manual-command-receipt-packs"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-manual-command-receipt-pack-actors"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-manual-command-receipt-pack-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-held-command-resolutions"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-held-command-resolution-plans"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-held-command-resolution-actors"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-protected-approval-request-packs"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-protected-approval-requests"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-protected-approval-actors"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-manual-revalidations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-manual-revalidation-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-manual-revalidation-actors"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-ready-manual-receipts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-queue-patch-projections"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-queue-patch-projection-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-queue-patch-operations"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-command-queue-patch-audit-candidates"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-closeout-ledgers"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-closeout-items"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-closeout-actors"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-cycle-completion-normalized-blocker-statuses"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-v1-regression-freezes"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-v1-regression-fixture-artifacts"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-v1-regression-checkpoints"));
      assert.ok(routeIndex.routes.some((route) => route.path === "/api/human-review-v1-freeze-notes"));
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

      const policySnapshotBindingLedgers = JSON.parse((await buildReviewApiResponse("/api/policy-snapshot-binding-ledgers?policy_snapshot_binding_status=complete", apiOptions)).body);
      assert.equal(policySnapshotBindingLedgers.collection, "policy_snapshot_binding_ledgers");
      assert.equal(policySnapshotBindingLedgers.count, 1);

      const workflowPolicyBindings = JSON.parse((await buildReviewApiResponse("/api/workflow-policy-bindings?binding_source=source_declared", apiOptions)).body);
      assert.equal(workflowPolicyBindings.collection, "workflow_policy_bindings");
      assert.equal(workflowPolicyBindings.count, policySnapshotBindingLedger.summary.workflow_policy_binding_count);

      const agentRunPolicyBindings = JSON.parse((await buildReviewApiResponse("/api/agent-run-policy-bindings?runtime_id=codex", apiOptions)).body);
      assert.equal(agentRunPolicyBindings.collection, "agent_run_policy_bindings");
      assert.ok(agentRunPolicyBindings.count >= 1);

      const eventPolicyBindings = JSON.parse((await buildReviewApiResponse("/api/event-policy-bindings?policy_snapshot_known=true", apiOptions)).body);
      assert.equal(eventPolicyBindings.collection, "event_policy_bindings");
      assert.equal(eventPolicyBindings.count, policySnapshotBindingLedger.summary.event_policy_binding_count);

      const gatePolicyBindings = JSON.parse((await buildReviewApiResponse("/api/gate-policy-bindings?binding_status=bound", apiOptions)).body);
      assert.equal(gatePolicyBindings.collection, "gate_policy_bindings");
      assert.equal(gatePolicyBindings.count, policySnapshotBindingLedger.summary.gate_policy_binding_count);

      const fallbackApprovalPolicyBindings = JSON.parse((await buildReviewApiResponse("/api/approval-policy-bindings?policy_snapshot_status=fallback_resolved", apiOptions)).body);
      assert.equal(fallbackApprovalPolicyBindings.collection, "approval_policy_bindings");
      assert.ok(fallbackApprovalPolicyBindings.count >= 1);

      const outputPolicyBindings = JSON.parse((await buildReviewApiResponse("/api/output-policy-bindings?policy_snapshot_known=true", apiOptions)).body);
      assert.equal(outputPolicyBindings.collection, "output_policy_bindings");
      assert.equal(outputPolicyBindings.count, policySnapshotBindingLedger.summary.output_policy_binding_count);

      const policySnapshotBindingValidations = JSON.parse((await buildReviewApiResponse("/api/policy-snapshot-binding-validations?status=passed", apiOptions)).body);
      assert.equal(policySnapshotBindingValidations.collection, "policy_snapshot_binding_validations");
      assert.equal(policySnapshotBindingValidations.count, policySnapshotBindingLedger.summary.validation_item_count);

      const policyContractFreezes = JSON.parse((await buildReviewApiResponse("/api/policy-contract-freezes?freeze_status=complete", apiOptions)).body);
      assert.equal(policyContractFreezes.collection, "policy_contract_freezes");
      assert.equal(policyContractFreezes.count, 1);

      const dataClassificationContracts = JSON.parse((await buildReviewApiResponse("/api/data-classification-contracts?classification=P5_SECRET", apiOptions)).body);
      assert.equal(dataClassificationContracts.collection, "data_classification_contracts");
      assert.equal(dataClassificationContracts.count, 1);
      assert.equal(dataClassificationContracts.items[0].external_model_policy, "forbidden");

      const policyReferenceContracts = JSON.parse((await buildReviewApiResponse("/api/policy-reference-contracts?reference_status=resolved", apiOptions)).body);
      assert.equal(policyReferenceContracts.collection, "policy_reference_contracts");
      assert.equal(policyReferenceContracts.count, policyContractFreeze.summary.resolved_policy_reference_count);

      const p2PolicyDecisionContracts = JSON.parse((await buildReviewApiResponse("/api/policy-decision-contracts?classification=P2_CLIENT_CONFIDENTIAL", apiOptions)).body);
      assert.equal(p2PolicyDecisionContracts.collection, "policy_decision_contracts");
      assert.equal(p2PolicyDecisionContracts.count, 1);
      assert.equal(p2PolicyDecisionContracts.items[0].external_model_policy, "approval_required");

      const policyContractValidations = JSON.parse((await buildReviewApiResponse("/api/policy-contract-validations?status=passed", apiOptions)).body);
      assert.equal(policyContractValidations.collection, "policy_contract_validations");
      assert.equal(policyContractValidations.count, policyContractFreeze.summary.validation_item_count);

      const evidenceContractFreezes = JSON.parse((await buildReviewApiResponse("/api/evidence-contract-freezes?freeze_status=complete", apiOptions)).body);
      assert.equal(evidenceContractFreezes.collection, "evidence_contract_freezes");
      assert.equal(evidenceContractFreezes.count, 1);

      const sourceSpanContracts = JSON.parse((await buildReviewApiResponse("/api/source-span-contracts?classification=P1_INTERNAL", apiOptions)).body);
      assert.equal(sourceSpanContracts.collection, "source_span_contracts");
      assert.ok(sourceSpanContracts.count >= 1);

      const evidenceItemContracts = JSON.parse((await buildReviewApiResponse("/api/evidence-item-contracts?review_status=needs_review", apiOptions)).body);
      assert.equal(evidenceItemContracts.collection, "evidence_item_contracts");
      assert.equal(evidenceItemContracts.count, evidenceContractFreeze.summary.evidence_item_count);

      const factType = evidenceContractFreeze.evidence_contract.fact_claims[0].fact_type;
      const factClaimContracts = JSON.parse((await buildReviewApiResponse(`/api/fact-claim-contracts?fact_type=${factType}`, apiOptions)).body);
      assert.equal(factClaimContracts.collection, "fact_claim_contracts");
      assert.equal(factClaimContracts.count, evidenceContractFreeze.summary.fact_claim_count);

      const issueType = evidenceContractFreeze.evidence_contract.issues[0].issue_type;
      const issueContracts = JSON.parse((await buildReviewApiResponse(`/api/issue-contracts?issue_type=${issueType}`, apiOptions)).body);
      assert.equal(issueContracts.collection, "issue_contracts");
      assert.equal(issueContracts.count, evidenceContractFreeze.summary.issue_count);

      const citationContracts = JSON.parse((await buildReviewApiResponse("/api/citation-contracts?citation_binding_status=bound", apiOptions)).body);
      assert.equal(citationContracts.collection, "citation_contracts");
      assert.equal(citationContracts.count, evidenceContractFreeze.summary.citation_bound_count);

      const lineageEdges = JSON.parse((await buildReviewApiResponse("/api/evidence-lineage-edges?relation=evidence_cited_by_citation", apiOptions)).body);
      assert.equal(lineageEdges.collection, "evidence_lineage_edges");
      assert.equal(lineageEdges.count, evidenceContractFreeze.summary.citation_count);

      const evidenceContractValidations = JSON.parse((await buildReviewApiResponse("/api/evidence-contract-validations?status=passed", apiOptions)).body);
      assert.equal(evidenceContractValidations.collection, "evidence_contract_validations");
      assert.equal(evidenceContractValidations.count, evidenceContractFreeze.summary.validation_item_count);

      const capabilityWorkflowContractFreezes = JSON.parse((await buildReviewApiResponse("/api/capability-workflow-contract-freezes?freeze_status=complete", apiOptions)).body);
      assert.equal(capabilityWorkflowContractFreezes.collection, "capability_workflow_contract_freezes");
      assert.equal(capabilityWorkflowContractFreezes.count, 1);

      const lawFirmCapabilityManifests = JSON.parse((await buildReviewApiResponse("/api/capability-manifest-v2-contracts?domain_pack=law-firm", apiOptions)).body);
      assert.equal(lawFirmCapabilityManifests.collection, "capability_manifest_v2_contracts");
      assert.equal(lawFirmCapabilityManifests.count, 2);

      const workflowContracts = JSON.parse((await buildReviewApiResponse("/api/workflow-v2-contracts?capability_id=law_firm.ldd.issue_report", apiOptions)).body);
      assert.equal(workflowContracts.collection, "workflow_v2_contracts");
      assert.equal(workflowContracts.count, 1);

      const workflowRunContracts = JSON.parse((await buildReviewApiResponse("/api/workflow-run-v2-contracts?status=blocked", apiOptions)).body);
      assert.equal(workflowRunContracts.collection, "workflow_run_v2_contracts");
      assert.equal(workflowRunContracts.count, capabilityWorkflowContractFreeze.summary.workflow_run_count);

      const codexAgentRunContracts = JSON.parse((await buildReviewApiResponse("/api/agent-run-v2-contracts?runtime_id=codex", apiOptions)).body);
      assert.equal(codexAgentRunContracts.collection, "agent_run_v2_contracts");
      assert.equal(codexAgentRunContracts.count, 1);

      const capabilityIoContracts = JSON.parse((await buildReviewApiResponse("/api/capability-io-contracts?input_output_status=complete", apiOptions)).body);
      assert.equal(capabilityIoContracts.collection, "capability_io_contracts");
      assert.equal(capabilityIoContracts.count, capabilityWorkflowContractFreeze.summary.capability_io_contract_count);

      const capabilityGateRuntimeContracts = JSON.parse((await buildReviewApiResponse("/api/capability-gate-runtime-contracts?capability_id=personal_dev.codex.worktree_patch", apiOptions)).body);
      assert.equal(capabilityGateRuntimeContracts.collection, "capability_gate_runtime_contracts");
      assert.equal(capabilityGateRuntimeContracts.count, 1);

      const workflowExecutionBindings = JSON.parse((await buildReviewApiResponse("/api/workflow-execution-bindings?status=blocked", apiOptions)).body);
      assert.equal(workflowExecutionBindings.collection, "workflow_execution_bindings");
      assert.equal(workflowExecutionBindings.count, capabilityWorkflowContractFreeze.summary.workflow_execution_binding_count);

      const capabilityWorkflowContractValidations = JSON.parse((await buildReviewApiResponse("/api/capability-workflow-contract-validations?status=passed", apiOptions)).body);
      assert.equal(capabilityWorkflowContractValidations.collection, "capability_workflow_contract_validations");
      assert.equal(capabilityWorkflowContractValidations.count, capabilityWorkflowContractFreeze.summary.validation_item_count);

      const runtimeAgentRunContractFreezes = JSON.parse((await buildReviewApiResponse("/api/runtime-agentrun-contract-freezes?freeze_status=complete", apiOptions)).body);
      assert.equal(runtimeAgentRunContractFreezes.collection, "runtime_agentrun_contract_freezes");
      assert.equal(runtimeAgentRunContractFreezes.count, 1);

      const highRiskRuntimeAdapters = JSON.parse((await buildReviewApiResponse("/api/runtime-adapter-v2-contracts?risk_level=high", apiOptions)).body);
      assert.equal(highRiskRuntimeAdapters.collection, "runtime_adapter_v2_contracts");
      assert.ok(highRiskRuntimeAdapters.count >= 2);

      const codexRuntimeExecutionContracts = JSON.parse((await buildReviewApiResponse("/api/runtime-execution-contracts?runtime_id=codex", apiOptions)).body);
      assert.equal(codexRuntimeExecutionContracts.collection, "runtime_execution_contracts");
      assert.equal(codexRuntimeExecutionContracts.count, 1);

      const codexAgentRunRuntimeContracts = JSON.parse((await buildReviewApiResponse("/api/agent-run-runtime-contracts?runtime_id=codex", apiOptions)).body);
      assert.equal(codexAgentRunRuntimeContracts.collection, "agent_run_runtime_contracts");
      assert.equal(codexAgentRunRuntimeContracts.count, 1);

      const untrustedRuntimeOutputContracts = JSON.parse((await buildReviewApiResponse("/api/runtime-output-contracts?output_trust=untrusted_until_verified", apiOptions)).body);
      assert.equal(untrustedRuntimeOutputContracts.collection, "runtime_output_contracts");
      assert.equal(untrustedRuntimeOutputContracts.count, runtimeAgentRunContractFreeze.summary.untrusted_output_agent_run_count);

      const capturedRuntimeLogContracts = JSON.parse((await buildReviewApiResponse("/api/runtime-log-contracts?log_capture_status=captured", apiOptions)).body);
      assert.equal(capturedRuntimeLogContracts.collection, "runtime_log_contracts");
      assert.equal(capturedRuntimeLogContracts.count, runtimeAgentRunContractFreeze.summary.agent_log_bound_count);

      const prDraftRuntimeArtifactContracts = JSON.parse((await buildReviewApiResponse("/api/runtime-artifact-contracts?artifact_type=pr_draft", apiOptions)).body);
      assert.equal(prDraftRuntimeArtifactContracts.collection, "runtime_artifact_contracts");
      assert.ok(prDraftRuntimeArtifactContracts.count >= 1);

      const pendingRuntimeVerificationContracts = JSON.parse((await buildReviewApiResponse("/api/runtime-verification-contracts?verification_status=pending_gate_review", apiOptions)).body);
      assert.equal(pendingRuntimeVerificationContracts.collection, "runtime_verification_contracts");
      assert.equal(pendingRuntimeVerificationContracts.count, runtimeAgentRunContractFreeze.summary.untrusted_output_agent_run_count);

      const runtimeAgentRunContractValidations = JSON.parse((await buildReviewApiResponse("/api/runtime-agentrun-contract-validations?status=passed", apiOptions)).body);
      assert.equal(runtimeAgentRunContractValidations.collection, "runtime_agentrun_contract_validations");
      assert.equal(runtimeAgentRunContractValidations.count, runtimeAgentRunContractFreeze.summary.validation_item_count);

      const gateApprovalContractFreezes = JSON.parse((await buildReviewApiResponse("/api/gate-approval-contract-freezes?freeze_status=complete", apiOptions)).body);
      assert.equal(gateApprovalContractFreezes.collection, "gate_approval_contract_freezes");
      assert.equal(gateApprovalContractFreezes.count, 1);

      const humanGateResultContracts = JSON.parse((await buildReviewApiResponse("/api/gate-result-contracts?gate_id=human_approval_gate", apiOptions)).body);
      assert.equal(humanGateResultContracts.collection, "gate_result_contracts");
      assert.equal(humanGateResultContracts.count, gateApprovalContractFreeze.summary.human_approval_gate_count);

      const approvalRequestContracts = JSON.parse((await buildReviewApiResponse("/api/approval-request-contracts?approval_source=approval_inbox", apiOptions)).body);
      assert.equal(approvalRequestContracts.collection, "approval_request_contracts");
      assert.equal(approvalRequestContracts.count, approvalInbox.summary.inbox_item_count);

      const approvalDecisionContracts = JSON.parse((await buildReviewApiResponse("/api/approval-decision-contracts?request_link_status=linked", apiOptions)).body);
      assert.equal(approvalDecisionContracts.collection, "approval_decision_contracts");
      assert.equal(approvalDecisionContracts.count, gateApprovalContractFreeze.summary.linked_approval_decision_count);

      const humanGateV2Contracts = JSON.parse((await buildReviewApiResponse("/api/human-gate-v2-contracts?requires_human=true", apiOptions)).body);
      assert.equal(humanGateV2Contracts.collection, "human_gate_v2_contracts");
      assert.equal(humanGateV2Contracts.count, gateApprovalContractFreeze.gate_approval_contract.human_gate_contracts.filter((contract) => contract.requires_human).length);

      const approvalAuthorityContracts = JSON.parse((await buildReviewApiResponse("/api/approval-authority-contracts?approval_authority_status=declared", apiOptions)).body);
      assert.equal(approvalAuthorityContracts.collection, "approval_authority_contracts");
      assert.equal(approvalAuthorityContracts.count, gateApprovalContractFreeze.summary.approval_authority_declared_count);

      const gateApprovalBindings = JSON.parse((await buildReviewApiResponse("/api/gate-approval-bindings?binding_status=linked", apiOptions)).body);
      assert.equal(gateApprovalBindings.collection, "gate_approval_bindings");
      assert.equal(gateApprovalBindings.count, gateApprovalContractFreeze.summary.linked_gate_approval_binding_count);

      const gateApprovalContractValidations = JSON.parse((await buildReviewApiResponse("/api/gate-approval-contract-validations?status=passed", apiOptions)).body);
      assert.equal(gateApprovalContractValidations.collection, "gate_approval_contract_validations");
      assert.equal(gateApprovalContractValidations.count, gateApprovalContractFreeze.summary.validation_item_count);

      const outputDeliveryContractFreezes = JSON.parse((await buildReviewApiResponse("/api/output-delivery-contract-freezes?freeze_status=complete", apiOptions)).body);
      assert.equal(outputDeliveryContractFreezes.collection, "output_delivery_contract_freezes");
      assert.equal(outputDeliveryContractFreezes.count, 1);

      const outputArtifactV2Contracts = JSON.parse((await buildReviewApiResponse("/api/output-artifact-v2-contracts?hash_status=present", apiOptions)).body);
      assert.equal(outputArtifactV2Contracts.collection, "output_artifact_v2_contracts");
      assert.equal(outputArtifactV2Contracts.count, outputDeliveryContractFreeze.summary.artifact_hash_count);

      const deliveryActionV2Contracts = JSON.parse((await buildReviewApiResponse("/api/delivery-action-v2-contracts?protected_action=true", apiOptions)).body);
      assert.equal(deliveryActionV2Contracts.collection, "delivery_action_v2_contracts");
      assert.equal(deliveryActionV2Contracts.count, outputDeliveryContractFreeze.summary.protected_delivery_action_count);

      const deliveryReceiptV2Contracts = JSON.parse((await buildReviewApiResponse("/api/delivery-receipt-v2-contracts?receipt_status=delivered", apiOptions)).body);
      assert.equal(deliveryReceiptV2Contracts.collection, "delivery_receipt_v2_contracts");
      assert.equal(deliveryReceiptV2Contracts.count, outputDeliveryContractFreeze.summary.delivered_receipt_count);

      const outputDeliveryBindings = JSON.parse((await buildReviewApiResponse("/api/output-delivery-bindings?binding_status=linked", apiOptions)).body);
      assert.equal(outputDeliveryBindings.collection, "output_delivery_bindings");
      assert.equal(outputDeliveryBindings.count, outputDeliveryContractFreeze.summary.linked_binding_count);

      const deliveryStateTransitions = JSON.parse((await buildReviewApiResponse("/api/delivery-state-transitions?transition_type=catalog_to_delivery_queue", apiOptions)).body);
      assert.equal(deliveryStateTransitions.collection, "delivery_state_transitions");
      assert.equal(deliveryStateTransitions.count, outputDeliveryContractFreeze.summary.delivery_action_count);

      const outputDeliveryContractValidations = JSON.parse((await buildReviewApiResponse("/api/output-delivery-contract-validations?status=passed", apiOptions)).body);
      assert.equal(outputDeliveryContractValidations.collection, "output_delivery_contract_validations");
      assert.equal(outputDeliveryContractValidations.count, outputDeliveryContractFreeze.summary.validation_item_count);

      const eventAuditRunContractFreezes = JSON.parse((await buildReviewApiResponse("/api/event-audit-run-contract-freezes?freeze_status=complete", apiOptions)).body);
      assert.equal(eventAuditRunContractFreezes.collection, "event_audit_run_contract_freezes");
      assert.equal(eventAuditRunContractFreezes.count, 1);

      const eventRecordV2Contracts = JSON.parse((await buildReviewApiResponse("/api/event-record-v2-contracts?policy_snapshot_status=source_declared", apiOptions)).body);
      assert.equal(eventRecordV2Contracts.collection, "event_record_v2_contracts");
      assert.equal(eventRecordV2Contracts.count, eventAuditRunContractFreeze.event_audit_run_contract.event_records.filter((event) => event.policy_snapshot_status === "source_declared").length);

      const auditEventV2Contracts = JSON.parse((await buildReviewApiResponse("/api/audit-event-v2-contracts?actor_type=human", apiOptions)).body);
      assert.equal(auditEventV2Contracts.collection, "audit_event_v2_contracts");
      assert.equal(auditEventV2Contracts.count, eventAuditRunContractFreeze.event_audit_run_contract.audit_events.filter((event) => event.actor_type === "human").length);

      const runLedgerV2Contracts = JSON.parse((await buildReviewApiResponse("/api/run-ledger-v2-contracts?run_status=blocked", apiOptions)).body);
      assert.equal(runLedgerV2Contracts.collection, "run_ledger_v2_contracts");
      assert.equal(runLedgerV2Contracts.count, eventAuditRunContractFreeze.event_audit_run_contract.run_ledgers.filter((run) => run.run_status === "blocked").length);

      const eventRunBindings = JSON.parse((await buildReviewApiResponse("/api/event-run-bindings?binding_status=linked", apiOptions)).body);
      assert.equal(eventRunBindings.collection, "event_run_bindings");
      assert.equal(eventRunBindings.count, eventAuditRunContractFreeze.summary.linked_event_run_binding_count);

      const eventAuditRunContractValidations = JSON.parse((await buildReviewApiResponse("/api/event-audit-run-contract-validations?status=passed", apiOptions)).body);
      assert.equal(eventAuditRunContractValidations.collection, "event_audit_run_contract_validations");
      assert.equal(eventAuditRunContractValidations.count, eventAuditRunContractFreeze.summary.validation_item_count);

      const errorCostObservabilityContractFreezes = JSON.parse((await buildReviewApiResponse("/api/error-cost-observability-contract-freezes?freeze_status=complete", apiOptions)).body);
      assert.equal(errorCostObservabilityContractFreezes.collection, "error_cost_observability_contract_freezes");
      assert.equal(errorCostObservabilityContractFreezes.count, 1);

      const errorRecordV2Contracts = JSON.parse((await buildReviewApiResponse("/api/error-record-v2-contracts?error_kind=run_blocked", apiOptions)).body);
      assert.equal(errorRecordV2Contracts.collection, "error_record_v2_contracts");
      assert.equal(errorRecordV2Contracts.count, errorCostObservabilityContractFreeze.summary.run_blocked_error_count);

      const costObservationV2Contracts = JSON.parse((await buildReviewApiResponse("/api/cost-observation-v2-contracts?cost_status=attributed", apiOptions)).body);
      assert.equal(costObservationV2Contracts.collection, "cost_observation_v2_contracts");
      assert.equal(costObservationV2Contracts.count, errorCostObservabilityContractFreeze.summary.cost_observation_count);

      const traceProjectionV2Contracts = JSON.parse((await buildReviewApiResponse("/api/trace-projection-v2-contracts?latency_status=observed", apiOptions)).body);
      assert.equal(traceProjectionV2Contracts.collection, "trace_projection_v2_contracts");
      assert.equal(traceProjectionV2Contracts.count, errorCostObservabilityContractFreeze.summary.latency_observed_count);

      const errorCostObservabilityContractValidations = JSON.parse((await buildReviewApiResponse("/api/error-cost-observability-contract-validations?status=passed", apiOptions)).body);
      assert.equal(errorCostObservabilityContractValidations.collection, "error_cost_observability_contract_validations");
      assert.equal(errorCostObservabilityContractValidations.count, errorCostObservabilityContractFreeze.summary.validation_item_count);

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

      const modelPolicyEnforcements = JSON.parse((await buildReviewApiResponse("/api/model-policy-enforcements", apiOptions)).body);
      assert.equal(modelPolicyEnforcements.collection, "model_policy_enforcements");
      assert.equal(modelPolicyEnforcements.count, 1);

      const sensitiveClassificationGates = JSON.parse((await buildReviewApiResponse("/api/classification-model-gates?sensitive_data=true", apiOptions)).body);
      assert.equal(sensitiveClassificationGates.collection, "classification_model_gates");
      assert.equal(sensitiveClassificationGates.count, modelPolicyEnforcement.summary.p2_p5_classification_gate_count);

      const resourceModelGates = JSON.parse((await buildReviewApiResponse("/api/resource-model-gates?gate_status=requires_approval", apiOptions)).body);
      assert.equal(resourceModelGates.collection, "resource_model_gates");
      assert.equal(resourceModelGates.count, modelPolicyEnforcement.summary.resource_model_gate_count);

      const routeModelGates = JSON.parse((await buildReviewApiResponse("/api/route-model-gates?external_transfer=true", apiOptions)).body);
      assert.equal(routeModelGates.collection, "route_model_gates");
      assert.equal(routeModelGates.count, modelPolicyEnforcement.summary.external_transfer_route_count);

      const modelPolicyEnforcementValidations = JSON.parse((await buildReviewApiResponse("/api/model-policy-enforcement-validations?status=passed", apiOptions)).body);
      assert.equal(modelPolicyEnforcementValidations.collection, "model_policy_enforcement_validations");
      assert.equal(modelPolicyEnforcementValidations.count, modelPolicyEnforcement.summary.validation_item_count);

      const toolRuntimePolicyEnforcements = JSON.parse((await buildReviewApiResponse("/api/tool-runtime-policy-enforcements", apiOptions)).body);
      assert.equal(toolRuntimePolicyEnforcements.collection, "tool_runtime_policy_enforcements");
      assert.equal(toolRuntimePolicyEnforcements.count, 1);

      const blockedRuntimePolicyGates = JSON.parse((await buildReviewApiResponse("/api/runtime-policy-gates?gate_status=blocked", apiOptions)).body);
      assert.equal(blockedRuntimePolicyGates.collection, "runtime_policy_gates");
      assert.equal(blockedRuntimePolicyGates.count, toolRuntimePolicyEnforcement.summary.blocked_runtime_policy_gate_count);

      const forbiddenToolPermissionGates = JSON.parse((await buildReviewApiResponse("/api/tool-permission-gates?requested_state=forbidden&gate_decision=deny", apiOptions)).body);
      assert.equal(forbiddenToolPermissionGates.collection, "tool_permission_gates");
      assert.equal(forbiddenToolPermissionGates.count, toolRuntimePolicyEnforcement.summary.forbidden_tool_gate_count);

      const agentRunToolGates = JSON.parse((await buildReviewApiResponse("/api/agent-run-tool-gates?gate_status=requires_approval", apiOptions)).body);
      assert.equal(agentRunToolGates.collection, "agent_run_tool_gates");
      assert.equal(agentRunToolGates.count, toolRuntimePolicyEnforcement.summary.agent_run_tool_gate_requires_approval_count);

      const toolRuntimePolicyValidations = JSON.parse((await buildReviewApiResponse("/api/tool-runtime-policy-validations?status=passed", apiOptions)).body);
      assert.equal(toolRuntimePolicyValidations.collection, "tool_runtime_policy_validations");
      assert.equal(toolRuntimePolicyValidations.count, toolRuntimePolicyEnforcement.summary.validation_item_count);

      const outputDestinationPolicyEnforcements = JSON.parse((await buildReviewApiResponse("/api/output-destination-policy-enforcements", apiOptions)).body);
      assert.equal(outputDestinationPolicyEnforcements.collection, "output_destination_policy_enforcements");
      assert.equal(outputDestinationPolicyEnforcements.count, 1);

      const githubPolicyDestinationRules = JSON.parse((await buildReviewApiResponse("/api/policy-destination-rules?destination_kind=github", apiOptions)).body);
      assert.equal(githubPolicyDestinationRules.collection, "policy_destination_rules");
      assert.equal(githubPolicyDestinationRules.count, 1);
      assert.equal(githubPolicyDestinationRules.items[0].destination_tool_id, "github.merge");

      const artifactDestinationGates = JSON.parse((await buildReviewApiResponse("/api/artifact-destination-gates?gate_status=requires_approval", apiOptions)).body);
      assert.equal(artifactDestinationGates.collection, "artifact_destination_gates");
      assert.equal(artifactDestinationGates.count, outputDestinationPolicyEnforcement.summary.artifact_destination_gate_count);

      const blockedDeliveryActionDestinationGates = JSON.parse((await buildReviewApiResponse("/api/delivery-action-destination-gates?final_action_status=blocked_pending_approval", apiOptions)).body);
      assert.equal(blockedDeliveryActionDestinationGates.collection, "delivery_action_destination_gates");
      assert.equal(blockedDeliveryActionDestinationGates.count, outputDestinationPolicyEnforcement.summary.blocked_final_action_count);

      const pendingFinalActionSeparationGates = JSON.parse((await buildReviewApiResponse("/api/final-action-separation-gates?separation_status=draft_and_final_action_separated_pending_approval", apiOptions)).body);
      assert.equal(pendingFinalActionSeparationGates.collection, "final_action_separation_gates");
      assert.equal(pendingFinalActionSeparationGates.count, outputDestinationPolicyEnforcement.summary.by_separation_status.draft_and_final_action_separated_pending_approval ?? 0);

      const outputDestinationPolicyValidations = JSON.parse((await buildReviewApiResponse("/api/output-destination-policy-validations?status=passed", apiOptions)).body);
      assert.equal(outputDestinationPolicyValidations.collection, "output_destination_policy_validations");
      assert.equal(outputDestinationPolicyValidations.count, outputDestinationPolicyEnforcement.summary.validation_item_count);

      const approvalAuthorityLedgers = JSON.parse((await buildReviewApiResponse("/api/approval-authority-ledgers", apiOptions)).body);
      assert.equal(approvalAuthorityLedgers.collection, "approval_authority_ledgers");
      assert.equal(approvalAuthorityLedgers.count, 1);

      const authorityPolicies = JSON.parse((await buildReviewApiResponse("/api/authority-policies?human_authority_required=true", apiOptions)).body);
      assert.equal(authorityPolicies.collection, "authority_policies");
      assert.equal(authorityPolicies.count, approvalAuthorityLedger.summary.authority_policy_count);

      const assignmentRequiredArtifactAuthorities = JSON.parse((await buildReviewApiResponse("/api/artifact-authority-decisions?authority_status=assignment_required", apiOptions)).body);
      assert.equal(assignmentRequiredArtifactAuthorities.collection, "artifact_authority_decisions");
      assert.equal(assignmentRequiredArtifactAuthorities.count, approvalAuthorityLedger.approval_authority_catalog.artifact_authority_decisions.filter((decision) => decision.authority_status === "assignment_required").length);

      const attorneyApprovalRequestAuthorities = JSON.parse((await buildReviewApiResponse("/api/approval-request-authority-decisions?required_authority_role=responsible_partner_or_reviewer", apiOptions)).body);
      assert.equal(attorneyApprovalRequestAuthorities.collection, "approval_request_authority_decisions");
      assert.ok(attorneyApprovalRequestAuthorities.count > 0);

      const assignmentRequiredDeliveryAuthorities = JSON.parse((await buildReviewApiResponse("/api/delivery-action-authority-decisions?gate_status=requires_assignment", apiOptions)).body);
      assert.equal(assignmentRequiredDeliveryAuthorities.collection, "delivery_action_authority_decisions");
      assert.equal(assignmentRequiredDeliveryAuthorities.count, approvalAuthorityLedger.approval_authority_catalog.delivery_action_authority_decisions.filter((decision) => decision.gate_status === "requires_assignment").length);

      const approvalAuthorityValidations = JSON.parse((await buildReviewApiResponse("/api/approval-authority-validations?status=passed", apiOptions)).body);
      assert.equal(approvalAuthorityValidations.collection, "approval_authority_validations");
      assert.equal(approvalAuthorityValidations.count, approvalAuthorityLedger.summary.validation_item_count);

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

      const humanReviewCorrectionWorkspaces = JSON.parse((await buildReviewApiResponse("/api/human-review-correction-workspaces?workspace_status=pending_human_review", apiOptions)).body);
      assert.equal(humanReviewCorrectionWorkspaces.collection, "human_review_correction_workspaces");
      assert.equal(humanReviewCorrectionWorkspaces.count, 1);

      const humanReviewCorrectionActors = JSON.parse((await buildReviewApiResponse("/api/human-review-correction-actors?required_actor=attorney_or_designated_reviewer", apiOptions)).body);
      assert.equal(humanReviewCorrectionActors.collection, "human_review_correction_actors");
      assert.equal(humanReviewCorrectionActors.count, 1);

      const humanReviewCorrectionItems = JSON.parse((await buildReviewApiResponse("/api/human-review-correction-items?correction_status=pending_decision", apiOptions)).body);
      assert.equal(humanReviewCorrectionItems.collection, "human_review_correction_items");
      assert.equal(humanReviewCorrectionItems.count, humanReviewCorrectionWorkspace.summary.pending_decision_count);

      const humanReviewCorrectionReceiptInput = JSON.parse((await buildReviewApiResponse("/api/human-review-correction-receipt-input?receipt_status=pending", apiOptions)).body);
      assert.equal(humanReviewCorrectionReceiptInput.collection, "human_review_correction_receipt_input");
      assert.equal(humanReviewCorrectionReceiptInput.count, humanReviewCorrectionWorkspace.summary.receipt_row_count);

      const humanReviewCorrectionWorkspaceMerges = JSON.parse((await buildReviewApiResponse("/api/human-review-correction-workspace-merges?merge_status=pending_receipts", apiOptions)).body);
      assert.equal(humanReviewCorrectionWorkspaceMerges.collection, "human_review_correction_workspace_merges");
      assert.equal(humanReviewCorrectionWorkspaceMerges.count, 1);

      const humanReviewCorrectionMergeActors = JSON.parse((await buildReviewApiResponse("/api/human-review-correction-merge-actors?required_actor=attorney_or_designated_reviewer", apiOptions)).body);
      assert.equal(humanReviewCorrectionMergeActors.collection, "human_review_correction_merge_actors");
      assert.equal(humanReviewCorrectionMergeActors.count, 1);

      const humanReviewCorrectionMergeItems = JSON.parse((await buildReviewApiResponse("/api/human-review-correction-merge-items?merge_status=pending_receipt", apiOptions)).body);
      assert.equal(humanReviewCorrectionMergeItems.collection, "human_review_correction_merge_items");
      assert.equal(humanReviewCorrectionMergeItems.count, humanReviewCorrectionWorkspaceMerge.summary.pending_receipt_count);

      const humanReviewMergedCorrectionReceiptInput = JSON.parse((await buildReviewApiResponse("/api/human-review-merged-correction-receipt-input?receipt_status=pending", apiOptions)).body);
      assert.equal(humanReviewMergedCorrectionReceiptInput.collection, "human_review_merged_correction_receipt_input");
      assert.equal(humanReviewMergedCorrectionReceiptInput.count, humanReviewCorrectionWorkspaceMerge.summary.receipt_row_count);

      const humanReviewCorrectionValidations = JSON.parse((await buildReviewApiResponse("/api/human-review-correction-validations?validation_status=pending_receipts", apiOptions)).body);
      assert.equal(humanReviewCorrectionValidations.collection, "human_review_correction_validations");
      assert.equal(humanReviewCorrectionValidations.count, 1);

      const humanReviewCorrectionValidationItems = JSON.parse((await buildReviewApiResponse("/api/human-review-correction-validation-items?validation_status=pending_receipt", apiOptions)).body);
      assert.equal(humanReviewCorrectionValidationItems.collection, "human_review_correction_validation_items");
      assert.equal(humanReviewCorrectionValidationItems.count, humanReviewCorrectionValidation.summary.pending_receipt_count);

      const humanReviewCorrectionValidationErrors = JSON.parse((await buildReviewApiResponse("/api/human-review-correction-validation-errors", apiOptions)).body);
      assert.equal(humanReviewCorrectionValidationErrors.collection, "human_review_correction_validation_errors");
      assert.equal(humanReviewCorrectionValidationErrors.count, 0);

      const validatedCorrectionHumanGateReceipts = JSON.parse((await buildReviewApiResponse("/api/validated-correction-human-gate-receipts", apiOptions)).body);
      assert.equal(validatedCorrectionHumanGateReceipts.collection, "validated_correction_human_gate_receipts");
      assert.equal(validatedCorrectionHumanGateReceipts.count, 0);

      const humanReviewCorrectionFeedbacks = JSON.parse((await buildReviewApiResponse("/api/human-review-correction-feedbacks?feedback_status=pending_human_review", apiOptions)).body);
      assert.equal(humanReviewCorrectionFeedbacks.collection, "human_review_correction_feedbacks");
      assert.equal(humanReviewCorrectionFeedbacks.count, 1);

      const humanReviewCorrectionFeedbackItems = JSON.parse((await buildReviewApiResponse("/api/human-review-correction-feedback-items?feedback_status=needs_human_decision", apiOptions)).body);
      assert.equal(humanReviewCorrectionFeedbackItems.collection, "human_review_correction_feedback_items");
      assert.equal(humanReviewCorrectionFeedbackItems.count, humanReviewCorrectionFeedback.summary.pending_receipt_count);

      const humanReviewCorrectionActorFeedback = JSON.parse((await buildReviewApiResponse("/api/human-review-correction-actor-feedback?required_actor=attorney_or_designated_reviewer", apiOptions)).body);
      assert.equal(humanReviewCorrectionActorFeedback.collection, "human_review_correction_actor_feedback");
      assert.equal(humanReviewCorrectionActorFeedback.count, 1);

      const humanReviewCycleLedgers = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-ledgers?cycle_status=pending_human_review", apiOptions)).body);
      assert.equal(humanReviewCycleLedgers.collection, "human_review_cycle_ledgers");
      assert.equal(humanReviewCycleLedgers.count, 1);

      const humanReviewCycleItems = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-items?cycle_status=pending_human_review", apiOptions)).body);
      assert.equal(humanReviewCycleItems.collection, "human_review_cycle_items");
      assert.equal(humanReviewCycleItems.count, humanReviewCycleLedger.summary.pending_human_review_count);

      const humanReviewActorCycles = JSON.parse((await buildReviewApiResponse("/api/human-review-actor-cycles?required_actor=attorney_or_designated_reviewer", apiOptions)).body);
      assert.equal(humanReviewActorCycles.collection, "human_review_actor_cycles");
      assert.equal(humanReviewActorCycles.count, 1);

      const humanReviewCycleWorkOrderResponse = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-work-orders?work_order_status=pending_human_review", apiOptions)).body);
      assert.equal(humanReviewCycleWorkOrderResponse.collection, "human_review_cycle_work_orders");
      assert.equal(humanReviewCycleWorkOrderResponse.count, 1);

      const humanReviewCycleWorkOrderItems = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-work-order-items?work_order_status=pending_human_review", apiOptions)).body);
      assert.equal(humanReviewCycleWorkOrderItems.collection, "human_review_cycle_work_order_items");
      assert.equal(humanReviewCycleWorkOrderItems.count, humanReviewCycleWorkOrderResponse.items[0].summary.pending_human_review_count);

      const humanReviewActorWorkOrders = JSON.parse((await buildReviewApiResponse("/api/human-review-actor-work-orders?required_actor=attorney_or_designated_reviewer", apiOptions)).body);
      assert.equal(humanReviewActorWorkOrders.collection, "human_review_actor_work_orders");
      assert.equal(humanReviewActorWorkOrders.count, 1);

      const humanReviewCycleTargetAudits = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-target-audits?target_audit_status=ready_for_human_review", apiOptions)).body);
      assert.equal(humanReviewCycleTargetAudits.collection, "human_review_cycle_target_audits");
      assert.equal(humanReviewCycleTargetAudits.count, 1);

      const humanReviewCycleTargetAuditItems = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-target-audit-items?target_audit_status=ready_for_human_review", apiOptions)).body);
      assert.equal(humanReviewCycleTargetAuditItems.collection, "human_review_cycle_target_audit_items");
      assert.equal(humanReviewCycleTargetAuditItems.count, humanReviewCycleTargetAudits.items[0].summary.ready_target_count);

      const humanReviewActorTargetAudits = JSON.parse((await buildReviewApiResponse("/api/human-review-actor-target-audits?required_actor=attorney_or_designated_reviewer", apiOptions)).body);
      assert.equal(humanReviewActorTargetAudits.collection, "human_review_actor_target_audits");
      assert.equal(humanReviewActorTargetAudits.count, 1);

      const humanReviewCycleTriageInboxes = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-triage-inboxes?triage_status=ready_for_human_review", apiOptions)).body);
      assert.equal(humanReviewCycleTriageInboxes.collection, "human_review_cycle_triage_inboxes");
      assert.equal(humanReviewCycleTriageInboxes.count, 1);

      const humanReviewCycleTriageItems = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-triage-items?triage_status=ready_for_human_review", apiOptions)).body);
      assert.equal(humanReviewCycleTriageItems.collection, "human_review_cycle_triage_items");
      assert.equal(humanReviewCycleTriageItems.count, humanReviewCycleTriageInboxes.items[0].summary.ready_for_human_review_count);

      const humanReviewActorTriageInboxes = JSON.parse((await buildReviewApiResponse("/api/human-review-actor-triage-inboxes?required_actor=attorney_or_designated_reviewer", apiOptions)).body);
      assert.equal(humanReviewActorTriageInboxes.collection, "human_review_actor_triage_inboxes");
      assert.equal(humanReviewActorTriageInboxes.count, 1);

      const humanReviewCycleReviewerConsoles = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-reviewer-consoles?console_status=ready_for_human_review", apiOptions)).body);
      assert.equal(humanReviewCycleReviewerConsoles.collection, "human_review_cycle_reviewer_consoles");
      assert.equal(humanReviewCycleReviewerConsoles.count, 1);

      const humanReviewCycleConsoleItems = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-console-items?console_status=ready_for_human_review", apiOptions)).body);
      assert.equal(humanReviewCycleConsoleItems.collection, "human_review_cycle_console_items");
      assert.equal(humanReviewCycleConsoleItems.count, humanReviewCycleReviewerConsoles.items[0].summary.ready_for_human_review_count);

      const humanReviewActorConsoles = JSON.parse((await buildReviewApiResponse("/api/human-review-actor-consoles?required_actor=attorney_or_designated_reviewer", apiOptions)).body);
      assert.equal(humanReviewActorConsoles.collection, "human_review_actor_consoles");
      assert.equal(humanReviewActorConsoles.count, 1);

      const humanReviewCycleFieldAudits = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-field-audits?field_audit_status=pending_human_review", apiOptions)).body);
      assert.equal(humanReviewCycleFieldAudits.collection, "human_review_cycle_field_audits");
      assert.equal(humanReviewCycleFieldAudits.count, 1);

      const humanReviewCycleFieldAuditItems = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-field-audit-items?field_audit_status=pending_human_review", apiOptions)).body);
      assert.equal(humanReviewCycleFieldAuditItems.collection, "human_review_cycle_field_audit_items");
      assert.equal(humanReviewCycleFieldAuditItems.count, humanReviewCycleFieldAudits.items[0].summary.pending_human_review_count);

      const humanReviewActorFieldAudits = JSON.parse((await buildReviewApiResponse("/api/human-review-actor-field-audits?required_actor=attorney_or_designated_reviewer", apiOptions)).body);
      assert.equal(humanReviewActorFieldAudits.collection, "human_review_actor_field_audits");
      assert.equal(humanReviewActorFieldAudits.count, 1);

      const humanReviewCycleCompletionPacks = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-packs?completion_status=ready_for_human_input", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionPacks.collection, "human_review_cycle_completion_packs");
      assert.equal(humanReviewCycleCompletionPacks.count, 1);

      const humanReviewCycleCompletionItems = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-items?completion_status=ready_for_human_input", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionItems.collection, "human_review_cycle_completion_items");
      assert.equal(humanReviewCycleCompletionItems.count, humanReviewCycleCompletionPacks.items[0].summary.ready_for_human_input_count);

      const humanReviewActorCompletionPacks = JSON.parse((await buildReviewApiResponse("/api/human-review-actor-completion-packs?required_actor=attorney_or_designated_reviewer", apiOptions)).body);
      assert.equal(humanReviewActorCompletionPacks.collection, "human_review_actor_completion_packs");
      assert.equal(humanReviewActorCompletionPacks.count, 1);

      const humanReviewCycleCompletionVerifications = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-verifications?verification_status=pending_human_input", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionVerifications.collection, "human_review_cycle_completion_verifications");
      assert.equal(humanReviewCycleCompletionVerifications.count, 1);

      const humanReviewCycleCompletionVerificationItems = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-verification-items?verification_status=pending_human_input", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionVerificationItems.collection, "human_review_cycle_completion_verification_items");
      assert.equal(humanReviewCycleCompletionVerificationItems.count, humanReviewCycleCompletionVerifications.items[0].summary.pending_human_input_count);

      const humanReviewActorCompletionVerifications = JSON.parse((await buildReviewApiResponse("/api/human-review-actor-completion-verifications?required_actor=attorney_or_designated_reviewer", apiOptions)).body);
      assert.equal(humanReviewActorCompletionVerifications.collection, "human_review_actor_completion_verifications");
      assert.equal(humanReviewActorCompletionVerifications.count, 1);

      const humanReviewCycleCompletionWorkbenches = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-workbenches?workbench_status=pending_human_input", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionWorkbenches.collection, "human_review_cycle_completion_workbenches");
      assert.equal(humanReviewCycleCompletionWorkbenches.count, 1);

      const humanReviewCycleCompletionWorkbenchItems = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-workbench-items?workbench_status=pending_human_input", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionWorkbenchItems.collection, "human_review_cycle_completion_workbench_items");
      assert.equal(humanReviewCycleCompletionWorkbenchItems.count, humanReviewCycleCompletionWorkbenches.items[0].summary.pending_human_input_count);

      const humanReviewActorCompletionWorkbenches = JSON.parse((await buildReviewApiResponse("/api/human-review-actor-completion-workbenches?required_actor=attorney_or_designated_reviewer", apiOptions)).body);
      assert.equal(humanReviewActorCompletionWorkbenches.collection, "human_review_actor_completion_workbenches");
      assert.equal(humanReviewActorCompletionWorkbenches.count, 1);

      const humanReviewCycleCompletionRunbooks = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-runbooks?runbook_status=pending_human_input", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionRunbooks.collection, "human_review_cycle_completion_runbooks");
      assert.equal(humanReviewCycleCompletionRunbooks.count, 1);

      const humanReviewCycleCompletionRunbookSteps = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-runbook-steps?step_status=pending_human_input", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionRunbookSteps.collection, "human_review_cycle_completion_runbook_steps");
      assert.ok(humanReviewCycleCompletionRunbookSteps.count >= 1);

      const humanReviewActorCompletionRunbooks = JSON.parse((await buildReviewApiResponse("/api/human-review-actor-completion-runbooks?required_actor=attorney_or_designated_reviewer", apiOptions)).body);
      assert.equal(humanReviewActorCompletionRunbooks.collection, "human_review_actor_completion_runbooks");
      assert.equal(humanReviewActorCompletionRunbooks.count, 1);

      const humanReviewCycleCompletionReadiness = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-readiness?readiness_status=waiting_for_human_input", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionReadiness.collection, "human_review_cycle_completion_readiness");
      assert.equal(humanReviewCycleCompletionReadiness.count, 1);

      const humanReviewCycleCompletionCommandGates = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-gates?command_status=available_now", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandGates.collection, "human_review_cycle_completion_command_gates");
      assert.ok(humanReviewCycleCompletionCommandGates.count >= 1);

      const humanReviewActorCompletionReadiness = JSON.parse((await buildReviewApiResponse("/api/human-review-actor-completion-readiness?required_actor=attorney_or_designated_reviewer", apiOptions)).body);
      assert.equal(humanReviewActorCompletionReadiness.collection, "human_review_actor_completion_readiness");
      assert.equal(humanReviewActorCompletionReadiness.count, 1);

      const humanReviewCycleCompletionCommandQueues = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-queues?queue_status=ready_with_holds", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandQueues.collection, "human_review_cycle_completion_command_queues");
      assert.equal(humanReviewCycleCompletionCommandQueues.count, 1);

      const humanReviewCycleCompletionCommandQueueItems = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-queue-items?queue_status=ready_to_run_manually", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandQueueItems.collection, "human_review_cycle_completion_command_queue_items");
      assert.ok(humanReviewCycleCompletionCommandQueueItems.count >= 1);

      const humanReviewCycleCompletionHeldCommands = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-held-commands?hold_status=held_until_manual_input", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionHeldCommands.collection, "human_review_cycle_completion_held_commands");
      assert.ok(humanReviewCycleCompletionHeldCommands.count >= 1);

      const humanReviewActorCompletionCommandQueues = JSON.parse((await buildReviewApiResponse("/api/human-review-actor-completion-command-queues?required_actor=attorney_or_designated_reviewer", apiOptions)).body);
      assert.equal(humanReviewActorCompletionCommandQueues.collection, "human_review_actor_completion_command_queues");
      assert.equal(humanReviewActorCompletionCommandQueues.count, 1);

      const humanReviewCycleCompletionCommandReceipts = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-receipts?receipt_status=pending_command_receipts", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandReceipts.collection, "human_review_cycle_completion_command_receipts");
      assert.equal(humanReviewCycleCompletionCommandReceipts.count, 1);

      const humanReviewCycleCompletionCommandReceiptRequirements = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-receipt-requirements?command_kind=verification_refresh", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandReceiptRequirements.collection, "human_review_cycle_completion_command_receipt_requirements");
      assert.ok(humanReviewCycleCompletionCommandReceiptRequirements.count >= 1);

      const humanReviewCycleCompletionCommandReceiptDrafts = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-receipt-drafts?command_result=not_run", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandReceiptDrafts.collection, "human_review_cycle_completion_command_receipt_drafts");
      assert.ok(humanReviewCycleCompletionCommandReceiptDrafts.count >= 1);

      const humanReviewCycleCompletionHeldCommandReferences = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-held-command-references?requires_explicit_human_approval=true", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionHeldCommandReferences.collection, "human_review_cycle_completion_held_command_references");
      assert.ok(humanReviewCycleCompletionHeldCommandReferences.count >= 1);

      const humanReviewCycleCompletionCommandReceiptValidations = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-receipt-validations?validation_status=pending_receipts", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandReceiptValidations.collection, "human_review_cycle_completion_command_receipt_validations");
      assert.equal(humanReviewCycleCompletionCommandReceiptValidations.count, 1);

      const humanReviewCycleCompletionCommandReceiptValidationItems = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-receipt-validation-items?validation_status=pending_receipt", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandReceiptValidationItems.collection, "human_review_cycle_completion_command_receipt_validation_items");
      assert.ok(humanReviewCycleCompletionCommandReceiptValidationItems.count >= 1);

      const humanReviewCycleCompletionCommandReceiptErrors = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-receipt-errors", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandReceiptErrors.collection, "human_review_cycle_completion_command_receipt_errors");
      assert.equal(humanReviewCycleCompletionCommandReceiptErrors.count, 0);

      const validatedHumanReviewCycleCompletionCommandReceipts = JSON.parse((await buildReviewApiResponse("/api/validated-human-review-cycle-completion-command-receipts", apiOptions)).body);
      assert.equal(validatedHumanReviewCycleCompletionCommandReceipts.collection, "validated_human_review_cycle_completion_command_receipts");
      assert.equal(validatedHumanReviewCycleCompletionCommandReceipts.count, 0);

      const humanReviewCycleCompletionCommandReceiptFeedbacks = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-receipt-feedbacks?feedback_status=pending_human_review", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandReceiptFeedbacks.collection, "human_review_cycle_completion_command_receipt_feedbacks");
      assert.equal(humanReviewCycleCompletionCommandReceiptFeedbacks.count, 1);

      const humanReviewCycleCompletionCommandReceiptFeedbackItems = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-receipt-feedback-items?feedback_status=needs_command_receipt", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandReceiptFeedbackItems.collection, "human_review_cycle_completion_command_receipt_feedback_items");
      assert.ok(humanReviewCycleCompletionCommandReceiptFeedbackItems.count >= 1);

      const humanReviewCycleCompletionCommandReceiptActorFeedback = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-receipt-actor-feedback?required_actor=human_reviewer", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandReceiptActorFeedback.collection, "human_review_cycle_completion_command_receipt_actor_feedback");
      assert.equal(humanReviewCycleCompletionCommandReceiptActorFeedback.count, 1);

      const humanReviewCycleCompletionCommandReceiptWorkspaces = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-receipt-workspaces?workspace_status=pending_human_review", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandReceiptWorkspaces.collection, "human_review_cycle_completion_command_receipt_workspaces");
      assert.equal(humanReviewCycleCompletionCommandReceiptWorkspaces.count, 1);

      const humanReviewCycleCompletionCommandReceiptWorkspaceItems = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-receipt-workspace-items?workspace_status=needs_command_receipt", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandReceiptWorkspaceItems.collection, "human_review_cycle_completion_command_receipt_workspace_items");
      assert.ok(humanReviewCycleCompletionCommandReceiptWorkspaceItems.count >= 1);

      const humanReviewCycleCompletionCommandReceiptActorWorkspaces = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-receipt-actor-workspaces?required_actor=human_reviewer", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandReceiptActorWorkspaces.collection, "human_review_cycle_completion_command_receipt_actor_workspaces");
      assert.equal(humanReviewCycleCompletionCommandReceiptActorWorkspaces.count, 1);

      const humanReviewCycleCompletionCommandReceiptWorkspaceMerges = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-receipt-workspace-merges?merge_status=pending_human_review", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandReceiptWorkspaceMerges.collection, "human_review_cycle_completion_command_receipt_workspace_merges");
      assert.equal(humanReviewCycleCompletionCommandReceiptWorkspaceMerges.count, 1);

      const humanReviewCycleCompletionCommandReceiptMergeItems = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-receipt-merge-items?merge_status=pending_receipt", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandReceiptMergeItems.collection, "human_review_cycle_completion_command_receipt_merge_items");
      assert.ok(humanReviewCycleCompletionCommandReceiptMergeItems.count >= 1);

      const humanReviewCycleCompletionCommandReceiptActorInputs = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-receipt-actor-inputs?required_actor=human_reviewer", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandReceiptActorInputs.collection, "human_review_cycle_completion_command_receipt_actor_inputs");
      assert.equal(humanReviewCycleCompletionCommandReceiptActorInputs.count, 1);

      const mergedHumanReviewCycleCompletionCommandReceiptInput = JSON.parse((await buildReviewApiResponse("/api/merged-human-review-cycle-completion-command-receipt-input", apiOptions)).body);
      assert.equal(mergedHumanReviewCycleCompletionCommandReceiptInput.collection, "merged_human_review_cycle_completion_command_receipt_input");
      assert.equal(mergedHumanReviewCycleCompletionCommandReceiptInput.count, 1);

      const humanReviewCycleCompletionCommandReceiptWorkspaceValidations = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-receipt-workspace-validations?validation_status=pending_receipts", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandReceiptWorkspaceValidations.collection, "human_review_cycle_completion_command_receipt_workspace_validations");
      assert.equal(humanReviewCycleCompletionCommandReceiptWorkspaceValidations.count, 1);

      const humanReviewCycleCompletionCommandReceiptWorkspaceValidationItems = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-receipt-workspace-validation-items?validation_status=pending_receipt", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandReceiptWorkspaceValidationItems.collection, "human_review_cycle_completion_command_receipt_workspace_validation_items");
      assert.ok(humanReviewCycleCompletionCommandReceiptWorkspaceValidationItems.count >= 1);

      const humanReviewCycleCompletionCommandReceiptWorkspaceValidationErrors = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-receipt-workspace-validation-errors", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandReceiptWorkspaceValidationErrors.collection, "human_review_cycle_completion_command_receipt_workspace_validation_errors");
      assert.equal(humanReviewCycleCompletionCommandReceiptWorkspaceValidationErrors.count, 0);

      const validatedHumanReviewCycleCompletionCommandWorkspaceReceipts = JSON.parse((await buildReviewApiResponse("/api/validated-human-review-cycle-completion-command-workspace-receipts", apiOptions)).body);
      assert.equal(validatedHumanReviewCycleCompletionCommandWorkspaceReceipts.collection, "validated_human_review_cycle_completion_command_workspace_receipts");
      assert.equal(validatedHumanReviewCycleCompletionCommandWorkspaceReceipts.count, 0);

      const humanReviewCycleCompletionCommandReceiptApplications = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-receipt-applications?application_status=nothing_to_apply", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandReceiptApplications.collection, "human_review_cycle_completion_command_receipt_applications");
      assert.equal(humanReviewCycleCompletionCommandReceiptApplications.count, 1);

      const appliedHumanReviewCycleCompletionCommandReceipts = JSON.parse((await buildReviewApiResponse("/api/applied-human-review-cycle-completion-command-receipts", apiOptions)).body);
      assert.equal(appliedHumanReviewCycleCompletionCommandReceipts.collection, "applied_human_review_cycle_completion_command_receipts");
      assert.equal(appliedHumanReviewCycleCompletionCommandReceipts.count, 0);

      const humanReviewCycleCompletionCommandReceiptApplicationPendingReceipts = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-receipt-application-pending-receipts?validation_status=pending_receipt", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandReceiptApplicationPendingReceipts.collection, "human_review_cycle_completion_command_receipt_application_pending_receipts");
      assert.ok(humanReviewCycleCompletionCommandReceiptApplicationPendingReceipts.count >= 1);

      const humanReviewCycleCompletionCommandReceiptApplicationAuditEvents = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-receipt-application-audit-events", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandReceiptApplicationAuditEvents.collection, "human_review_cycle_completion_command_receipt_application_audit_events");
      assert.equal(humanReviewCycleCompletionCommandReceiptApplicationAuditEvents.count, 0);

      const humanReviewCycleCompletionReconciliations = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-reconciliations?reconciliation_status=waiting_for_manual_command_receipts", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionReconciliations.collection, "human_review_cycle_completion_reconciliations");
      assert.equal(humanReviewCycleCompletionReconciliations.count, 1);

      const humanReviewCycleCompletionReconciliationItems = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-reconciliation-items?reconciliation_status=waiting_for_manual_command_receipt", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionReconciliationItems.collection, "human_review_cycle_completion_reconciliation_items");
      assert.ok(humanReviewCycleCompletionReconciliationItems.count >= 1);

      const humanReviewCycleCompletionReconciliationActors = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-reconciliation-actors?required_actor=human_reviewer", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionReconciliationActors.collection, "human_review_cycle_completion_reconciliation_actors");
      assert.equal(humanReviewCycleCompletionReconciliationActors.count, 1);

      const humanReviewCycleCompletionBaselines = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-baselines?baseline_status=frozen_with_blockers", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionBaselines.collection, "human_review_cycle_completion_baselines");
      assert.equal(humanReviewCycleCompletionBaselines.count, 1);

      const humanReviewCycleCompletionBaselineBlockers = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-baseline-blockers?blocker_status=waiting_for_manual_command_receipt", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionBaselineBlockers.collection, "human_review_cycle_completion_baseline_blockers");
      assert.ok(humanReviewCycleCompletionBaselineBlockers.count >= 1);

      const humanReviewCycleCompletionManualCommandReceiptPacks = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-manual-command-receipt-packs?pack_status=ready_for_manual_receipts", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionManualCommandReceiptPacks.collection, "human_review_cycle_completion_manual_command_receipt_packs");
      assert.equal(humanReviewCycleCompletionManualCommandReceiptPacks.count, 1);

      const humanReviewCycleCompletionManualCommandReceiptPackActors = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-manual-command-receipt-pack-actors?required_actor=human_reviewer", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionManualCommandReceiptPackActors.collection, "human_review_cycle_completion_manual_command_receipt_pack_actors");
      assert.equal(humanReviewCycleCompletionManualCommandReceiptPackActors.count, 1);

      const humanReviewCycleCompletionHeldCommandResolutions = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-held-command-resolutions?resolution_status=ready_for_actor_resolution", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionHeldCommandResolutions.collection, "human_review_cycle_completion_held_command_resolutions");
      assert.equal(humanReviewCycleCompletionHeldCommandResolutions.count, 1);

      const humanReviewCycleCompletionHeldCommandResolutionPlans = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-held-command-resolution-plans?resolution_status=waiting_for_manual_input", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionHeldCommandResolutionPlans.collection, "human_review_cycle_completion_held_command_resolution_plans");
      assert.ok(humanReviewCycleCompletionHeldCommandResolutionPlans.count >= 1);

      const humanReviewCycleCompletionHeldCommandResolutionActors = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-held-command-resolution-actors?required_actor=authorized_operator", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionHeldCommandResolutionActors.collection, "human_review_cycle_completion_held_command_resolution_actors");
      assert.equal(humanReviewCycleCompletionHeldCommandResolutionActors.count, 1);

      const humanReviewCycleCompletionProtectedApprovalRequestPacks = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-protected-approval-request-packs?pack_status=ready_for_explicit_approval", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionProtectedApprovalRequestPacks.collection, "human_review_cycle_completion_protected_approval_request_packs");
      assert.equal(humanReviewCycleCompletionProtectedApprovalRequestPacks.count, 1);

      const humanReviewCycleCompletionProtectedApprovalRequests = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-protected-approval-requests?approval_status=pending_explicit_approval", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionProtectedApprovalRequests.collection, "human_review_cycle_completion_protected_approval_requests");
      assert.equal(humanReviewCycleCompletionProtectedApprovalRequests.count, humanReviewCycleReceiptCompletionProtectedApprovalRequestPack.summary.approval_request_count);

      const humanReviewCycleCompletionProtectedApprovalActors = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-protected-approval-actors?required_actor=authorized_operator", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionProtectedApprovalActors.collection, "human_review_cycle_completion_protected_approval_actors");
      assert.equal(humanReviewCycleCompletionProtectedApprovalActors.count, 1);

      const humanReviewCycleCompletionManualRevalidations = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-manual-revalidations?revalidation_status=waiting_for_human_receipts", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionManualRevalidations.collection, "human_review_cycle_completion_manual_revalidations");
      assert.equal(humanReviewCycleCompletionManualRevalidations.count, 1);

      const humanReviewCycleCompletionManualRevalidationItems = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-manual-revalidation-items?revalidation_status=pending_human_receipt", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionManualRevalidationItems.collection, "human_review_cycle_completion_manual_revalidation_items");
      assert.equal(humanReviewCycleCompletionManualRevalidationItems.count, humanReviewCycleReceiptCompletionManualRevalidation.summary.pending_human_receipt_count);

      const humanReviewCycleCompletionManualRevalidationActors = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-manual-revalidation-actors?required_actor=human_reviewer", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionManualRevalidationActors.collection, "human_review_cycle_completion_manual_revalidation_actors");
      assert.equal(humanReviewCycleCompletionManualRevalidationActors.count, 1);

      const humanReviewCycleCompletionReadyManualReceipts = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-ready-manual-receipts", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionReadyManualReceipts.collection, "human_review_cycle_completion_ready_manual_receipts");
      assert.equal(humanReviewCycleCompletionReadyManualReceipts.count, 0);

      const humanReviewCycleCompletionCommandQueuePatchProjections = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-queue-patch-projections?projection_status=waiting_for_human_receipts", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandQueuePatchProjections.collection, "human_review_cycle_completion_command_queue_patch_projections");
      assert.equal(humanReviewCycleCompletionCommandQueuePatchProjections.count, 1);

      const humanReviewCycleCompletionCommandQueuePatchProjectionItems = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-queue-patch-projection-items?projection_status=waiting_for_human_receipt", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandQueuePatchProjectionItems.collection, "human_review_cycle_completion_command_queue_patch_projection_items");
      assert.equal(humanReviewCycleCompletionCommandQueuePatchProjectionItems.count, humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.waiting_patch_count);

      const humanReviewCycleCompletionCommandQueuePatchOperations = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-queue-patch-operations", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandQueuePatchOperations.collection, "human_review_cycle_completion_command_queue_patch_operations");
      assert.equal(humanReviewCycleCompletionCommandQueuePatchOperations.count, 0);

      const humanReviewCycleCompletionCommandQueuePatchAuditCandidates = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-command-queue-patch-audit-candidates?event_status=held_pending_manual_receipt", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCommandQueuePatchAuditCandidates.collection, "human_review_cycle_completion_command_queue_patch_audit_candidates");
      assert.equal(humanReviewCycleCompletionCommandQueuePatchAuditCandidates.count, humanReviewCycleReceiptCompletionCommandQueuePatchProjection.summary.audit_event_candidate_count);

      const humanReviewCycleCompletionCloseoutLedgers = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-closeout-ledgers?closeout_status=open_pending", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCloseoutLedgers.collection, "human_review_cycle_completion_closeout_ledgers");
      assert.equal(humanReviewCycleCompletionCloseoutLedgers.count, 1);

      const humanReviewCycleCompletionCloseoutItems = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-closeout-items?normalized_status=pending", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCloseoutItems.collection, "human_review_cycle_completion_closeout_items");
      assert.equal(humanReviewCycleCompletionCloseoutItems.count, humanReviewCycleReceiptCompletionCloseoutLedger.summary.pending_count);

      const humanReviewCycleCompletionCloseoutActors = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-closeout-actors?closeout_status=pending", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionCloseoutActors.collection, "human_review_cycle_completion_closeout_actors");
      assert.equal(humanReviewCycleCompletionCloseoutActors.count, humanReviewCycleReceiptCompletionCloseoutLedger.summary.actor_closeout_count);

      const humanReviewCycleCompletionNormalizedBlockerStatuses = JSON.parse((await buildReviewApiResponse("/api/human-review-cycle-completion-normalized-blocker-statuses?normalized_status=pending", apiOptions)).body);
      assert.equal(humanReviewCycleCompletionNormalizedBlockerStatuses.collection, "human_review_cycle_completion_normalized_blocker_statuses");
      assert.equal(humanReviewCycleCompletionNormalizedBlockerStatuses.count, 1);

      const humanReviewV1RegressionFreezes = JSON.parse((await buildReviewApiResponse("/api/human-review-v1-regression-freezes?freeze_status=frozen_with_pending_human_actions", apiOptions)).body);
      assert.equal(humanReviewV1RegressionFreezes.collection, "human_review_v1_regression_freezes");
      assert.equal(humanReviewV1RegressionFreezes.count, 1);

      const humanReviewV1RegressionFixtureArtifacts = JSON.parse((await buildReviewApiResponse("/api/human-review-v1-regression-fixture-artifacts?available=true", apiOptions)).body);
      assert.equal(humanReviewV1RegressionFixtureArtifacts.collection, "human_review_v1_regression_fixture_artifacts");
      assert.equal(humanReviewV1RegressionFixtureArtifacts.count, humanReviewV1RegressionFreeze.summary.regression_fixture_artifact_count);

      const humanReviewV1RegressionCheckpoints = JSON.parse((await buildReviewApiResponse("/api/human-review-v1-regression-checkpoints?checkpoint_status=passed", apiOptions)).body);
      assert.equal(humanReviewV1RegressionCheckpoints.collection, "human_review_v1_regression_checkpoints");
      assert.equal(humanReviewV1RegressionCheckpoints.count, humanReviewV1RegressionFreeze.summary.verification_checkpoint_count);

      const humanReviewV1FreezeNotes = JSON.parse((await buildReviewApiResponse("/api/human-review-v1-freeze-notes?freeze_status=frozen_with_pending_human_actions", apiOptions)).body);
      assert.equal(humanReviewV1FreezeNotes.collection, "human_review_v1_freeze_notes");
      assert.equal(humanReviewV1FreezeNotes.count, 1);

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

      const contractInventories = JSON.parse((await buildReviewApiResponse("/api/contract-inventories?inventory_status=complete", apiOptions)).body);
      assert.equal(contractInventories.collection, "contract_inventories");
      assert.equal(contractInventories.count, 1);

      const contractInventoryItems = JSON.parse((await buildReviewApiResponse("/api/contract-inventory-items?item_type=schema", apiOptions)).body);
      assert.equal(contractInventoryItems.collection, "contract_inventory_items");
      assert.equal(contractInventoryItems.count, contractInventory.summary.schema_count);

      const contractSchemas = JSON.parse((await buildReviewApiResponse("/api/contract-schemas?parse_status=parsed", apiOptions)).body);
      assert.equal(contractSchemas.collection, "contract_schemas");
      assert.equal(contractSchemas.count, contractInventory.summary.parsed_schema_count);

      const contractArtifacts = JSON.parse((await buildReviewApiResponse("/api/contract-artifacts?owner_area=gate_approval", apiOptions)).body);
      assert.equal(contractArtifacts.collection, "contract_artifacts");
      assert.ok(contractArtifacts.count >= 1);

      const contractOwnerMap = JSON.parse((await buildReviewApiResponse("/api/contract-owner-map?owner_area=core_contracts", apiOptions)).body);
      assert.equal(contractOwnerMap.collection, "contract_owner_map");
      assert.ok(contractOwnerMap.count >= 1);

      const contractDependencyMaps = JSON.parse((await buildReviewApiResponse("/api/contract-dependency-maps?map_status=complete", apiOptions)).body);
      assert.equal(contractDependencyMaps.collection, "contract_dependency_maps");
      assert.equal(contractDependencyMaps.count, 1);

      const contractDependencyNodes = JSON.parse((await buildReviewApiResponse("/api/contract-dependency-nodes?item_type=schema", apiOptions)).body);
      assert.equal(contractDependencyNodes.collection, "contract_dependency_nodes");
      assert.equal(contractDependencyNodes.count, contractInventory.summary.schema_count);

      const contractDependencyEdges = JSON.parse((await buildReviewApiResponse("/api/contract-dependency-edges?edge_type=artifact_contract_to_dashboard_source", apiOptions)).body);
      assert.equal(contractDependencyEdges.collection, "contract_dependency_edges");
      assert.equal(contractDependencyEdges.count, contractDependencyMap.summary.dashboard_dependency_edge_count);

      const contractBreakingChangeRisks = JSON.parse((await buildReviewApiResponse("/api/contract-breaking-change-risks?risk_level=low", apiOptions)).body);
      assert.equal(contractBreakingChangeRisks.collection, "contract_breaking_change_risks");
      assert.equal(contractBreakingChangeRisks.count, contractDependencyMap.summary.low_risk_count);

      const contractOwnerDependencies = JSON.parse((await buildReviewApiResponse("/api/contract-owner-dependencies?direction_status=allowed", apiOptions)).body);
      assert.equal(contractOwnerDependencies.collection, "contract_owner_dependencies");
      assert.equal(contractOwnerDependencies.count, contractDependencyMap.summary.owner_dependency_count);

      const schemaVersioningRuleArtifacts = JSON.parse((await buildReviewApiResponse("/api/schema-versioning-rules?guideline_status=complete", apiOptions)).body);
      assert.equal(schemaVersioningRuleArtifacts.collection, "schema_versioning_rules");
      assert.equal(schemaVersioningRuleArtifacts.count, 1);

      const schemaVersionPolicies = JSON.parse((await buildReviewApiResponse("/api/schema-version-policies?rule_id=optional_addition_default", apiOptions)).body);
      assert.equal(schemaVersionPolicies.collection, "schema_version_policies");
      assert.equal(schemaVersionPolicies.count, 1);

      const schemaVersionRecords = JSON.parse((await buildReviewApiResponse("/api/schema-version-records?version_status=versioned", apiOptions)).body);
      assert.equal(schemaVersionRecords.collection, "schema_version_records");
      assert.equal(schemaVersionRecords.count, schemaVersioningRules.summary.versioned_schema_count);

      const schemaLegacyExceptions = JSON.parse((await buildReviewApiResponse("/api/schema-legacy-exceptions?exception_status=allowed", apiOptions)).body);
      assert.equal(schemaLegacyExceptions.collection, "schema_legacy_exceptions");
      assert.equal(schemaLegacyExceptions.count, schemaVersioningRules.summary.legacy_exception_count);

      const schemaVersioningValidations = JSON.parse((await buildReviewApiResponse("/api/schema-versioning-validations?status=passed", apiOptions)).body);
      assert.equal(schemaVersioningValidations.collection, "schema_versioning_validations");
      assert.equal(schemaVersioningValidations.count, schemaVersioningRules.summary.validation_item_count);

      const schemaMigrationManifests = JSON.parse((await buildReviewApiResponse("/api/schema-migration-manifests?migration_manifest_status=complete", apiOptions)).body);
      assert.equal(schemaMigrationManifests.collection, "schema_migration_manifests");
      assert.equal(schemaMigrationManifests.count, 1);

      const schemaMigrationManifestRecords = JSON.parse((await buildReviewApiResponse("/api/schema-migration-manifest-records?migration_scope=core", apiOptions)).body);
      assert.equal(schemaMigrationManifestRecords.collection, "schema_migration_manifest_records");
      assert.equal(schemaMigrationManifestRecords.count, 1);

      const schemaMigrationRecords = JSON.parse((await buildReviewApiResponse("/api/schema-migration-records?dry_run_status=not_run", apiOptions)).body);
      assert.equal(schemaMigrationRecords.collection, "schema_migration_records");
      assert.equal(schemaMigrationRecords.count, schemaMigrationManifest.summary.migration_record_count);

      const schemaMigrationValidations = JSON.parse((await buildReviewApiResponse("/api/schema-migration-validations?status=passed", apiOptions)).body);
      assert.equal(schemaMigrationValidations.collection, "schema_migration_validations");
      assert.equal(schemaMigrationValidations.count, schemaMigrationManifest.summary.validation_item_count);

      const contractGoldenFixtureArtifacts = JSON.parse((await buildReviewApiResponse("/api/contract-golden-fixtures?golden_fixture_status=complete", apiOptions)).body);
      assert.equal(contractGoldenFixtureArtifacts.collection, "contract_golden_fixtures");
      assert.equal(contractGoldenFixtureArtifacts.count, 1);

      const contractGoldenFixtureRecords = JSON.parse((await buildReviewApiResponse("/api/contract-golden-fixture-records?schema_validation_status=passed", apiOptions)).body);
      assert.equal(contractGoldenFixtureRecords.collection, "contract_golden_fixture_records");
      assert.equal(contractGoldenFixtureRecords.count, contractGoldenFixtures.summary.schema_valid_fixture_count);

      const contractGoldenRegressionHashes = JSON.parse((await buildReviewApiResponse("/api/contract-golden-regression-hashes?regression_status=locked", apiOptions)).body);
      assert.equal(contractGoldenRegressionHashes.collection, "contract_golden_regression_hashes");
      assert.equal(contractGoldenRegressionHashes.count, contractGoldenFixtures.summary.locked_regression_hash_count);

      const contractGoldenFixtureValidations = JSON.parse((await buildReviewApiResponse("/api/contract-golden-fixture-validations?status=passed", apiOptions)).body);
      assert.equal(contractGoldenFixtureValidations.collection, "contract_golden_fixture_validations");
      assert.equal(contractGoldenFixtureValidations.count, contractGoldenFixtures.summary.validation_item_count);

      const contractValidationSuites = JSON.parse((await buildReviewApiResponse("/api/contract-validation-suites?validation_suite_status=complete", apiOptions)).body);
      assert.equal(contractValidationSuites.collection, "contract_validation_suites");
      assert.equal(contractValidationSuites.count, 1);

      const contractValidationFixtureResults = JSON.parse((await buildReviewApiResponse("/api/contract-validation-fixture-results?regression_status=passed", apiOptions)).body);
      assert.equal(contractValidationFixtureResults.collection, "contract_validation_fixture_results");
      assert.equal(contractValidationFixtureResults.count, contractValidationSuite.summary.regression_passed_count);

      const contractValidationCommands = JSON.parse((await buildReviewApiResponse("/api/contract-validation-commands?script_status=present", apiOptions)).body);
      assert.equal(contractValidationCommands.collection, "contract_validation_commands");
      assert.equal(contractValidationCommands.count, contractValidationSuite.summary.present_package_script_count);

      const contractValidationItems = JSON.parse((await buildReviewApiResponse("/api/contract-validation-items?status=passed", apiOptions)).body);
      assert.equal(contractValidationItems.collection, "contract_validation_items");
      assert.equal(contractValidationItems.count, contractValidationSuite.summary.validation_item_count);

      const identityModels = JSON.parse((await buildReviewApiResponse("/api/identity-models?identity_model_status=complete", apiOptions)).body);
      assert.equal(identityModels.collection, "identity_models");
      assert.equal(identityModels.count, 1);

      const identityUsers = JSON.parse((await buildReviewApiResponse("/api/identity-users?tenant_id=tenant.amic", apiOptions)).body);
      assert.equal(identityUsers.collection, "identity_users");
      assert.equal(identityUsers.count, identityModel.summary.user_count);

      const identityRoles = JSON.parse((await buildReviewApiResponse("/api/identity-roles?role_scope=tenant", apiOptions)).body);
      assert.equal(identityRoles.collection, "identity_roles");
      assert.equal(identityRoles.count, identityModel.summary.tenant_role_count);

      const identityRoleAssignments = JSON.parse((await buildReviewApiResponse("/api/identity-role-assignments?assignment_scope=tenant", apiOptions)).body);
      assert.equal(identityRoleAssignments.collection, "identity_role_assignments");
      assert.equal(identityRoleAssignments.count, identityModel.summary.tenant_role_count);

      const identityActors = JSON.parse((await buildReviewApiResponse("/api/identity-actors?principal_class=human_actor", apiOptions)).body);
      assert.equal(identityActors.collection, "identity_actors");
      assert.equal(identityActors.count, identityModel.summary.human_actor_principal_count);

      const identityBindings = JSON.parse((await buildReviewApiResponse("/api/identity-bindings?binding_type=human_user_actor", apiOptions)).body);
      assert.equal(identityBindings.collection, "identity_bindings");
      assert.equal(identityBindings.count, identityModel.summary.human_actor_user_binding_count);

      const identityValidations = JSON.parse((await buildReviewApiResponse("/api/identity-validations?status=passed", apiOptions)).body);
      assert.equal(identityValidations.collection, "identity_validations");
      assert.equal(identityValidations.count, identityModel.summary.validation_item_count);

      const resourceContractFreezes = JSON.parse((await buildReviewApiResponse("/api/resource-contract-freezes?freeze_status=complete", apiOptions)).body);
      assert.equal(resourceContractFreezes.collection, "resource_contract_freezes");
      assert.equal(resourceContractFreezes.count, 1);

      const resourceV2Contracts = JSON.parse((await buildReviewApiResponse("/api/resource-v2-contracts?source_system=local_filesystem", apiOptions)).body);
      assert.equal(resourceV2Contracts.collection, "resource_v2_contracts");
      assert.equal(resourceV2Contracts.count, resourceContractFreeze.summary.resource_count);

      const resourceVersionV2Contracts = JSON.parse((await buildReviewApiResponse("/api/resource-version-v2-contracts?version_status=current", apiOptions)).body);
      assert.equal(resourceVersionV2Contracts.collection, "resource_version_v2_contracts");
      assert.equal(resourceVersionV2Contracts.count, resourceContractFreeze.summary.current_resource_version_count);

      const resourceContractValidations = JSON.parse((await buildReviewApiResponse("/api/resource-contract-validations?status=passed", apiOptions)).body);
      assert.equal(resourceContractValidations.collection, "resource_contract_validations");
      assert.equal(resourceContractValidations.count, resourceContractFreeze.summary.validation_item_count);

      const resourceStoreInterfaces = JSON.parse((await buildReviewApiResponse("/api/resource-store-interfaces?resource_store_interface_status=complete", apiOptions)).body);
      assert.equal(resourceStoreInterfaces.collection, "resource_store_interfaces");
      assert.equal(resourceStoreInterfaces.count, 1);

      const resourceStoreRecords = JSON.parse((await buildReviewApiResponse("/api/resource-store-records?collection_id=resource_store", apiOptions)).body);
      assert.equal(resourceStoreRecords.collection, "resource_store_records");
      assert.equal(resourceStoreRecords.count, resourceStoreInterface.summary.resource_store_record_count);

      const resourceVersionStoreRecords = JSON.parse((await buildReviewApiResponse("/api/resource-version-store-records?collection_id=resource_version_store", apiOptions)).body);
      assert.equal(resourceVersionStoreRecords.collection, "resource_version_store_records");
      assert.equal(resourceVersionStoreRecords.count, resourceStoreInterface.summary.resource_version_store_record_count);

      const resourceStoreAdapterBindings = JSON.parse((await buildReviewApiResponse("/api/resource-store-adapter-bindings?interface_contract_id=resource-store-interface.v1", apiOptions)).body);
      assert.equal(resourceStoreAdapterBindings.collection, "resource_store_adapter_bindings");
      assert.equal(resourceStoreAdapterBindings.count, resourceStoreInterface.summary.adapter_binding_count);

      const resourceStoreValidations = JSON.parse((await buildReviewApiResponse("/api/resource-store-validations?status=passed", apiOptions)).body);
      assert.equal(resourceStoreValidations.collection, "resource_store_validations");
      assert.equal(resourceStoreValidations.count, resourceStoreInterface.summary.validation_item_count);

      const immutableObjectStoreLayouts = JSON.parse((await buildReviewApiResponse("/api/immutable-object-store-layouts?object_store_layout_status=complete", apiOptions)).body);
      assert.equal(immutableObjectStoreLayouts.collection, "immutable_object_store_layouts");
      assert.equal(immutableObjectStoreLayouts.count, 1);

      const objectPathResolvers = JSON.parse((await buildReviewApiResponse("/api/object-path-resolvers?overwrite_policy=forbidden", apiOptions)).body);
      assert.equal(objectPathResolvers.collection, "object_path_resolvers");
      assert.equal(objectPathResolvers.count, immutableObjectStoreLayout.summary.path_resolver_count);

      const rawSourceObjectPaths = JSON.parse((await buildReviewApiResponse("/api/raw-source-object-paths?namespace=raw-source", apiOptions)).body);
      assert.equal(rawSourceObjectPaths.collection, "raw_source_object_paths");
      assert.equal(rawSourceObjectPaths.count, immutableObjectStoreLayout.summary.raw_source_object_path_count);

      const generatedOutputObjectPaths = JSON.parse((await buildReviewApiResponse("/api/generated-output-object-paths?namespace=generated-output", apiOptions)).body);
      assert.equal(generatedOutputObjectPaths.collection, "generated_output_object_paths");
      assert.equal(generatedOutputObjectPaths.count, immutableObjectStoreLayout.summary.generated_output_object_path_count);

      const objectStoreCollisions = JSON.parse((await buildReviewApiResponse("/api/object-store-collisions", apiOptions)).body);
      assert.equal(objectStoreCollisions.collection, "object_store_collisions");
      assert.equal(objectStoreCollisions.count, 0);

      const objectStoreLayoutValidations = JSON.parse((await buildReviewApiResponse("/api/object-store-layout-validations?status=passed", apiOptions)).body);
      assert.equal(objectStoreLayoutValidations.collection, "object_store_layout_validations");
      assert.equal(objectStoreLayoutValidations.count, immutableObjectStoreLayout.summary.validation_item_count);

      const resourceVersionLedgers = JSON.parse((await buildReviewApiResponse("/api/resource-version-ledgers?resource_version_ledger_status=complete", apiOptions)).body);
      assert.equal(resourceVersionLedgers.collection, "resource_version_ledgers");
      assert.equal(resourceVersionLedgers.count, 1);

      const resourceVersionFamilies = JSON.parse((await buildReviewApiResponse("/api/resource-version-families", apiOptions)).body);
      assert.equal(resourceVersionFamilies.collection, "resource_version_families");
      assert.equal(resourceVersionFamilies.count, resourceVersionLedger.summary.version_family_count);

      const resourceVersionEvents = JSON.parse((await buildReviewApiResponse("/api/resource-version-events?event_type=version_recorded", apiOptions)).body);
      assert.equal(resourceVersionEvents.collection, "resource_version_events");
      assert.equal(resourceVersionEvents.count, resourceVersionLedger.summary.resource_version_count);

      const resourceVersionTransitions = JSON.parse((await buildReviewApiResponse("/api/resource-version-transitions", apiOptions)).body);
      assert.equal(resourceVersionTransitions.collection, "resource_version_transitions");
      assert.equal(resourceVersionTransitions.count, resourceVersionLedger.summary.version_transition_count);

      const resourceDuplicateCandidates = JSON.parse((await buildReviewApiResponse("/api/resource-duplicate-candidates", apiOptions)).body);
      assert.equal(resourceDuplicateCandidates.collection, "resource_duplicate_candidates");
      assert.equal(resourceDuplicateCandidates.count, resourceVersionLedger.summary.duplicate_candidate_count);

      const resourceVersionObjectBindings = JSON.parse((await buildReviewApiResponse("/api/resource-version-object-bindings?binding_status=bound", apiOptions)).body);
      assert.equal(resourceVersionObjectBindings.collection, "resource_version_object_bindings");
      assert.equal(resourceVersionObjectBindings.count, resourceVersionLedger.summary.object_path_binding_count);

      const resourceVersionLedgerValidations = JSON.parse((await buildReviewApiResponse("/api/resource-version-ledger-validations?status=passed", apiOptions)).body);
      assert.equal(resourceVersionLedgerValidations.collection, "resource_version_ledger_validations");
      assert.equal(resourceVersionLedgerValidations.count, resourceVersionLedger.summary.validation_item_count);

      const normalizedTextContracts = JSON.parse((await buildReviewApiResponse("/api/normalized-text-contracts?normalized_text_contract_status=complete", apiOptions)).body);
      assert.equal(normalizedTextContracts.collection, "normalized_text_contracts");
      assert.equal(normalizedTextContracts.count, 1);

      const normalizedTextArtifacts = JSON.parse((await buildReviewApiResponse("/api/normalized-text-artifacts?offset_unit=utf16_code_unit", apiOptions)).body);
      assert.equal(normalizedTextArtifacts.collection, "normalized_text_artifacts");
      assert.equal(normalizedTextArtifacts.count, normalizedTextContract.summary.normalized_text_artifact_count);

      const normalizedTextLocationMaps = JSON.parse((await buildReviewApiResponse("/api/normalized-text-location-maps?offset_unit=utf16_code_unit", apiOptions)).body);
      assert.equal(normalizedTextLocationMaps.collection, "normalized_text_location_maps");
      assert.equal(normalizedTextLocationMaps.count, normalizedTextContract.summary.location_map_count);

      const normalizedSourceSpanSeeds = JSON.parse((await buildReviewApiResponse("/api/normalized-source-span-seeds?seed_status=ready", apiOptions)).body);
      assert.equal(normalizedSourceSpanSeeds.collection, "normalized_source_span_seeds");
      assert.equal(normalizedSourceSpanSeeds.count, normalizedTextContract.summary.source_span_seed_count);

      const normalizedTextValidations = JSON.parse((await buildReviewApiResponse("/api/normalized-text-validations?status=passed", apiOptions)).body);
      assert.equal(normalizedTextValidations.collection, "normalized_text_validations");
      assert.equal(normalizedTextValidations.count, normalizedTextContract.summary.validation_item_count);

      const extractorAdapterContracts = JSON.parse((await buildReviewApiResponse("/api/extractor-adapter-contracts?extractor_adapter_contract_status=complete", apiOptions)).body);
      assert.equal(extractorAdapterContracts.collection, "extractor_adapter_contracts");
      assert.equal(extractorAdapterContracts.count, 1);

      const extractorAdapters = JSON.parse((await buildReviewApiResponse("/api/extractor-adapters?execution_boundary=local_deterministic", apiOptions)).body);
      assert.equal(extractorAdapters.collection, "extractor_adapters");
      assert.equal(extractorAdapters.count, extractorAdapterContract.summary.extractor_adapter_count);

      const extractorIoContracts = JSON.parse((await buildReviewApiResponse("/api/extractor-io-contracts?offset_unit=utf16_code_unit", apiOptions)).body);
      assert.equal(extractorIoContracts.collection, "extractor_io_contracts");
      assert.equal(extractorIoContracts.count, extractorAdapterContract.summary.extractor_io_contract_count);

      const extractorDocumentTypeBindings = JSON.parse((await buildReviewApiResponse("/api/extractor-document-type-bindings?binding_status=active", apiOptions)).body);
      assert.equal(extractorDocumentTypeBindings.collection, "extractor_document_type_bindings");
      assert.equal(extractorDocumentTypeBindings.count, extractorAdapterContract.summary.document_type_binding_count);

      const ocrFallbackPolicies = JSON.parse((await buildReviewApiResponse("/api/ocr-fallback-policies?external_service_allowed=false", apiOptions)).body);
      assert.equal(ocrFallbackPolicies.collection, "ocr_fallback_policies");
      assert.equal(ocrFallbackPolicies.count, extractorAdapterContract.summary.ocr_fallback_policy_count);

      const extractorNormalizedTextBindings = JSON.parse((await buildReviewApiResponse("/api/extractor-normalized-text-bindings?binding_status=bound", apiOptions)).body);
      assert.equal(extractorNormalizedTextBindings.collection, "extractor_normalized_text_bindings");
      assert.equal(extractorNormalizedTextBindings.count, extractorAdapterContract.summary.normalized_text_binding_count);

      const extractorAdapterValidations = JSON.parse((await buildReviewApiResponse("/api/extractor-adapter-validations?status=passed", apiOptions)).body);
      assert.equal(extractorAdapterValidations.collection, "extractor_adapter_validations");
      assert.equal(extractorAdapterValidations.count, extractorAdapterContract.summary.validation_item_count);

      const sourceSpanStores = JSON.parse((await buildReviewApiResponse("/api/source-span-stores?source_span_store_status=complete", apiOptions)).body);
      assert.equal(sourceSpanStores.collection, "source_span_stores");
      assert.equal(sourceSpanStores.count, 1);

      const sourceSpans = JSON.parse((await buildReviewApiResponse("/api/source-spans?location_type=page", apiOptions)).body);
      assert.equal(sourceSpans.collection, "source_spans");
      assert.equal(sourceSpans.count, sourceSpanStore.summary.page_span_count);

      const sourceSpanLocators = JSON.parse((await buildReviewApiResponse("/api/source-span-locators?offset_unit=utf16_code_unit", apiOptions)).body);
      assert.equal(sourceSpanLocators.collection, "source_span_locators");
      assert.equal(sourceSpanLocators.count, sourceSpanStore.summary.source_span_locator_count);

      const sourceSpanLocationUnits = JSON.parse((await buildReviewApiResponse("/api/source-span-location-units?timestamp_status=not_applicable", apiOptions)).body);
      assert.equal(sourceSpanLocationUnits.collection, "source_span_location_units");
      assert.equal(sourceSpanLocationUnits.count, sourceSpanStore.summary.source_span_location_unit_count);

      const sourceSpanIndexes = JSON.parse((await buildReviewApiResponse("/api/source-span-indexes?schema_version=source-span-indexes.v1", apiOptions)).body);
      assert.equal(sourceSpanIndexes.collection, "source_span_indexes");
      assert.equal(sourceSpanIndexes.count, 1);

      const sourceSpanValidations = JSON.parse((await buildReviewApiResponse("/api/source-span-validations?status=passed", apiOptions)).body);
      assert.equal(sourceSpanValidations.collection, "source_span_validations");
      assert.equal(sourceSpanValidations.count, sourceSpanStore.summary.validation_item_count);

      const evidenceItemStores = JSON.parse((await buildReviewApiResponse("/api/evidence-item-stores?evidence_item_store_status=complete", apiOptions)).body);
      assert.equal(evidenceItemStores.collection, "evidence_item_stores");
      assert.equal(evidenceItemStores.count, 1);

      const evidenceItems = JSON.parse((await buildReviewApiResponse("/api/evidence-items?review_status=needs_review", apiOptions)).body);
      assert.equal(evidenceItems.collection, "evidence_items");
      assert.equal(evidenceItems.count, evidenceItemStore.summary.needs_review_count);

      const evidenceSourceSpanBindings = JSON.parse((await buildReviewApiResponse("/api/evidence-source-span-bindings?binding_status=bound", apiOptions)).body);
      assert.equal(evidenceSourceSpanBindings.collection, "evidence_source_span_bindings");
      assert.equal(evidenceSourceSpanBindings.count, evidenceItemStore.summary.evidence_source_span_binding_count);

      const evidenceReviewQueue = JSON.parse((await buildReviewApiResponse("/api/evidence-review-queue?review_required=true", apiOptions)).body);
      assert.equal(evidenceReviewQueue.collection, "evidence_review_queue");
      assert.equal(evidenceReviewQueue.count, evidenceItemStore.summary.review_queue_item_count);

      const evidenceItemIndexes = JSON.parse((await buildReviewApiResponse("/api/evidence-item-indexes?schema_version=evidence-item-indexes.v1", apiOptions)).body);
      assert.equal(evidenceItemIndexes.collection, "evidence_item_indexes");
      assert.equal(evidenceItemIndexes.count, 1);

      const evidenceItemStoreValidations = JSON.parse((await buildReviewApiResponse("/api/evidence-item-store-validations?status=passed", apiOptions)).body);
      assert.equal(evidenceItemStoreValidations.collection, "evidence_item_store_validations");
      assert.equal(evidenceItemStoreValidations.count, evidenceItemStore.summary.validation_item_count);

      const factClaimStores = JSON.parse((await buildReviewApiResponse("/api/fact-claim-stores?fact_claim_store_status=complete", apiOptions)).body);
      assert.equal(factClaimStores.collection, "fact_claim_stores");
      assert.equal(factClaimStores.count, 1);

      const factClaims = JSON.parse((await buildReviewApiResponse("/api/fact-claims?review_status=needs_review", apiOptions)).body);
      assert.equal(factClaims.collection, "fact_claims");
      assert.equal(factClaims.count, factClaimStore.summary.needs_review_count);

      const factEvidenceBindings = JSON.parse((await buildReviewApiResponse("/api/fact-evidence-bindings?binding_status=bound", apiOptions)).body);
      assert.equal(factEvidenceBindings.collection, "fact_evidence_bindings");
      assert.equal(factEvidenceBindings.count, factClaimStore.summary.fact_evidence_binding_count);

      const factReviewQueue = JSON.parse((await buildReviewApiResponse("/api/fact-review-queue?review_required=true", apiOptions)).body);
      assert.equal(factReviewQueue.collection, "fact_review_queue");
      assert.equal(factReviewQueue.count, factClaimStore.summary.review_queue_item_count);

      const factClaimIndexes = JSON.parse((await buildReviewApiResponse("/api/fact-claim-indexes?schema_version=fact-claim-indexes.v1", apiOptions)).body);
      assert.equal(factClaimIndexes.collection, "fact_claim_indexes");
      assert.equal(factClaimIndexes.count, 1);

      const factClaimStoreValidations = JSON.parse((await buildReviewApiResponse("/api/fact-claim-store-validations?status=passed", apiOptions)).body);
      assert.equal(factClaimStoreValidations.collection, "fact_claim_store_validations");
      assert.equal(factClaimStoreValidations.count, factClaimStore.summary.validation_item_count);

      const issueGraphStores = JSON.parse((await buildReviewApiResponse("/api/issue-graph-stores?issue_graph_store_status=complete", apiOptions)).body);
      assert.equal(issueGraphStores.collection, "issue_graph_stores");
      assert.equal(issueGraphStores.count, 1);

      const issues = JSON.parse((await buildReviewApiResponse("/api/issues?review_status=needs_review", apiOptions)).body);
      assert.equal(issues.collection, "issues");
      assert.equal(issues.count, issueGraphStore.summary.needs_review_count);

      const factIssueBindings = JSON.parse((await buildReviewApiResponse("/api/fact-issue-bindings?binding_status=bound", apiOptions)).body);
      assert.equal(factIssueBindings.collection, "fact_issue_bindings");
      assert.equal(factIssueBindings.count, issueGraphStore.summary.fact_issue_binding_count);

      const legalRules = JSON.parse((await buildReviewApiResponse("/api/legal-rules?human_review_required=true", apiOptions)).body);
      assert.equal(legalRules.collection, "legal_rules");
      assert.equal(legalRules.count, issueGraphStore.summary.legal_rule_count);

      const issueLegalRuleBindings = JSON.parse((await buildReviewApiResponse("/api/issue-legal-rule-bindings?verification_status=requires_attorney_confirmation", apiOptions)).body);
      assert.equal(issueLegalRuleBindings.collection, "issue_legal_rule_bindings");
      assert.equal(issueLegalRuleBindings.count, issueGraphStore.summary.legal_rule_binding_count);

      const riskSeverityAssessments = JSON.parse((await buildReviewApiResponse("/api/risk-severity-assessments?review_status=needs_review", apiOptions)).body);
      assert.equal(riskSeverityAssessments.collection, "risk_severity_assessments");
      assert.equal(riskSeverityAssessments.count, issueGraphStore.summary.risk_severity_assessment_count);

      const issueReviewQueue = JSON.parse((await buildReviewApiResponse("/api/issue-review-queue?review_required=true", apiOptions)).body);
      assert.equal(issueReviewQueue.collection, "issue_review_queue");
      assert.equal(issueReviewQueue.count, issueGraphStore.summary.review_queue_item_count);

      const issueGraphIndexes = JSON.parse((await buildReviewApiResponse("/api/issue-graph-indexes?schema_version=issue-graph-indexes.v1", apiOptions)).body);
      assert.equal(issueGraphIndexes.collection, "issue_graph_indexes");
      assert.equal(issueGraphIndexes.count, 1);

      const issueGraphStoreValidations = JSON.parse((await buildReviewApiResponse("/api/issue-graph-store-validations?status=passed", apiOptions)).body);
      assert.equal(issueGraphStoreValidations.collection, "issue_graph_store_validations");
      assert.equal(issueGraphStoreValidations.count, issueGraphStore.summary.validation_item_count);

      const citationObjectStores = JSON.parse((await buildReviewApiResponse("/api/citation-object-stores?citation_object_store_status=complete", apiOptions)).body);
      assert.equal(citationObjectStores.collection, "citation_object_stores");
      assert.equal(citationObjectStores.count, 1);

      const outputParagraphs = JSON.parse((await buildReviewApiResponse("/api/output-paragraphs?client_facing_status=not_client_facing", apiOptions)).body);
      assert.equal(outputParagraphs.collection, "output_paragraphs");
      assert.equal(outputParagraphs.count, citationObjectStore.summary.not_client_facing_paragraph_count);

      const citations = JSON.parse((await buildReviewApiResponse("/api/citations?citation_status=needs_review", apiOptions)).body);
      assert.equal(citations.collection, "citations");
      assert.equal(citations.count, citationObjectStore.summary.needs_review_count);

      const paragraphSourceBindings = JSON.parse((await buildReviewApiResponse("/api/paragraph-source-bindings?binding_status=bound", apiOptions)).body);
      assert.equal(paragraphSourceBindings.collection, "paragraph_source_bindings");
      assert.equal(paragraphSourceBindings.count, citationObjectStore.summary.paragraph_source_binding_count);

      const citationReviewQueue = JSON.parse((await buildReviewApiResponse("/api/citation-review-queue?review_required=true", apiOptions)).body);
      assert.equal(citationReviewQueue.collection, "citation_review_queue");
      assert.equal(citationReviewQueue.count, citationObjectStore.summary.review_queue_item_count);

      const citationIndexes = JSON.parse((await buildReviewApiResponse("/api/citation-indexes?schema_version=citation-indexes.v1", apiOptions)).body);
      assert.equal(citationIndexes.collection, "citation_indexes");
      assert.equal(citationIndexes.count, 1);

      const citationObjectStoreValidations = JSON.parse((await buildReviewApiResponse("/api/citation-object-store-validations?status=passed", apiOptions)).body);
      assert.equal(citationObjectStoreValidations.collection, "citation_object_store_validations");
      assert.equal(citationObjectStoreValidations.count, citationObjectStore.summary.validation_item_count);

      const lineageGraphArtifacts = JSON.parse((await buildReviewApiResponse("/api/lineage-graphs?lineage_graph_status=complete", apiOptions)).body);
      assert.equal(lineageGraphArtifacts.collection, "lineage_graphs");
      assert.equal(lineageGraphArtifacts.count, 1);

      const lineageGraphNodes = JSON.parse((await buildReviewApiResponse("/api/lineage-nodes?node_type=source_span", apiOptions)).body);
      assert.equal(lineageGraphNodes.collection, "lineage_nodes");
      assert.equal(lineageGraphNodes.count, lineageGraphBuilder.summary.source_span_node_count);

      const lineageGraphEdges = JSON.parse((await buildReviewApiResponse("/api/lineage-edges?edge_type=source_span_cited_by_output", apiOptions)).body);
      assert.equal(lineageGraphEdges.collection, "lineage_edges");
      assert.equal(lineageGraphEdges.count, lineageGraphBuilder.summary.lineage_path_count);

      const lineageGraphPaths = JSON.parse((await buildReviewApiResponse("/api/lineage-paths?path_status=complete", apiOptions)).body);
      assert.equal(lineageGraphPaths.collection, "lineage_paths");
      assert.equal(lineageGraphPaths.count, lineageGraphBuilder.summary.complete_lineage_path_count);

      const lineageGraphIndexes = JSON.parse((await buildReviewApiResponse("/api/lineage-indexes?schema_version=lineage-indexes.v1", apiOptions)).body);
      assert.equal(lineageGraphIndexes.collection, "lineage_indexes");
      assert.equal(lineageGraphIndexes.count, 1);

      const lineageGraphValidations = JSON.parse((await buildReviewApiResponse("/api/lineage-graph-validations?status=passed", apiOptions)).body);
      assert.equal(lineageGraphValidations.collection, "lineage_graph_validations");
      assert.equal(lineageGraphValidations.count, lineageGraphBuilder.summary.validation_item_count);

      const evidenceCoverageArtifacts = JSON.parse((await buildReviewApiResponse("/api/evidence-coverage-scores?evidence_coverage_status=complete", apiOptions)).body);
      assert.equal(evidenceCoverageArtifacts.collection, "evidence_coverage_scores");
      assert.equal(evidenceCoverageArtifacts.count, 1);

      const evidenceCoverageRecords = JSON.parse((await buildReviewApiResponse("/api/evidence-coverage-records?review_status=needs_review", apiOptions)).body);
      assert.equal(evidenceCoverageRecords.collection, "evidence_coverage_records");
      assert.equal(evidenceCoverageRecords.count, evidenceCoverageScore.summary.coverage_score_count);

      const evidenceCoverageDimensions = JSON.parse((await buildReviewApiResponse("/api/evidence-coverage-dimensions?dimension=legal_basis", apiOptions)).body);
      assert.equal(evidenceCoverageDimensions.collection, "evidence_coverage_dimensions");
      assert.equal(evidenceCoverageDimensions.count, evidenceCoverageScore.summary.legal_basis_dimension_count);

      const evidenceCoverageIndexes = JSON.parse((await buildReviewApiResponse("/api/evidence-coverage-indexes?schema_version=coverage-indexes.v1", apiOptions)).body);
      assert.equal(evidenceCoverageIndexes.collection, "evidence_coverage_indexes");
      assert.equal(evidenceCoverageIndexes.count, 1);

      const evidenceCoverageValidations = JSON.parse((await buildReviewApiResponse("/api/evidence-coverage-validations?status=passed", apiOptions)).body);
      assert.equal(evidenceCoverageValidations.collection, "evidence_coverage_validations");
      assert.equal(evidenceCoverageValidations.count, evidenceCoverageScore.summary.validation_item_count);

      const evidenceFlagsArtifacts = JSON.parse((await buildReviewApiResponse("/api/evidence-flags?evidence_flags_status=complete", apiOptions)).body);
      assert.equal(evidenceFlagsArtifacts.collection, "evidence_flags");
      assert.equal(evidenceFlagsArtifacts.count, 1);

      const evidenceFlagRecords = JSON.parse((await buildReviewApiResponse("/api/evidence-flag-records?review_status=needs_review", apiOptions)).body);
      assert.equal(evidenceFlagRecords.collection, "evidence_flag_records");
      assert.equal(evidenceFlagRecords.count, evidenceFlags.summary.evidence_flag_record_count);

      const evidenceFlagDecisions = JSON.parse((await buildReviewApiResponse("/api/evidence-flag-decisions?flag_type=redaction", apiOptions)).body);
      assert.equal(evidenceFlagDecisions.collection, "evidence_flag_decisions");
      assert.equal(evidenceFlagDecisions.count, evidenceFlags.summary.evidence_flag_record_count);

      const evidenceFlagIndexes = JSON.parse((await buildReviewApiResponse("/api/evidence-flag-indexes?schema_version=evidence-flag-indexes.v1", apiOptions)).body);
      assert.equal(evidenceFlagIndexes.collection, "evidence_flag_indexes");
      assert.equal(evidenceFlagIndexes.count, 1);

      const evidenceFlagValidations = JSON.parse((await buildReviewApiResponse("/api/evidence-flag-validations?status=passed", apiOptions)).body);
      assert.equal(evidenceFlagValidations.collection, "evidence_flag_validations");
      assert.equal(evidenceFlagValidations.count, evidenceFlags.summary.validation_item_count);

      const exhibitMaps = JSON.parse((await buildReviewApiResponse("/api/exhibit-maps?exhibit_map_status=complete", apiOptions)).body);
      assert.equal(exhibitMaps.collection, "exhibit_maps");
      assert.equal(exhibitMaps.count, 1);

      const exhibitRecords = JSON.parse((await buildReviewApiResponse("/api/exhibit-records?review_status=needs_review", apiOptions)).body);
      assert.equal(exhibitRecords.collection, "exhibit_records");
      assert.equal(exhibitRecords.count, exhibitMap.summary.exhibit_record_count);

      const exhibitBindings = JSON.parse((await buildReviewApiResponse("/api/exhibit-bindings?binding_type=exhibit_to_evidence", apiOptions)).body);
      assert.equal(exhibitBindings.collection, "exhibit_bindings");
      assert.equal(exhibitBindings.count, exhibitMap.summary.exhibit_record_count);

      const exhibitIndexes = JSON.parse((await buildReviewApiResponse("/api/exhibit-indexes?schema_version=exhibit-indexes.v1", apiOptions)).body);
      assert.equal(exhibitIndexes.collection, "exhibit_indexes");
      assert.equal(exhibitIndexes.count, 1);

      const exhibitMapValidations = JSON.parse((await buildReviewApiResponse("/api/exhibit-map-validations?status=passed", apiOptions)).body);
      assert.equal(exhibitMapValidations.collection, "exhibit_map_validations");
      assert.equal(exhibitMapValidations.count, exhibitMap.summary.validation_item_count);

      const custodyLedgers = JSON.parse((await buildReviewApiResponse("/api/custody-event-ledgers?custody_event_ledger_status=complete", apiOptions)).body);
      assert.equal(custodyLedgers.collection, "custody_event_ledgers");
      assert.equal(custodyLedgers.count, 1);

      const custodyEvents = JSON.parse((await buildReviewApiResponse("/api/custody-events?event_stage=approve", apiOptions)).body);
      assert.equal(custodyEvents.collection, "custody_events");
      assert.equal(custodyEvents.count, chainOfCustodyEvents.summary.approve_event_count);

      const custodyEventLinks = JSON.parse((await buildReviewApiResponse("/api/custody-event-links?link_status=bound", apiOptions)).body);
      assert.equal(custodyEventLinks.collection, "custody_event_links");
      assert.equal(custodyEventLinks.count, chainOfCustodyEvents.summary.custody_event_link_count);

      const custodyStageIndexes = JSON.parse((await buildReviewApiResponse("/api/custody-stage-indexes?event_stage=approve", apiOptions)).body);
      assert.equal(custodyStageIndexes.collection, "custody_stage_indexes");
      assert.equal(custodyStageIndexes.count, 1);

      const custodyEventValidations = JSON.parse((await buildReviewApiResponse("/api/custody-event-validations?status=passed", apiOptions)).body);
      assert.equal(custodyEventValidations.collection, "custody_event_validations");
      assert.equal(custodyEventValidations.count, chainOfCustodyEvents.summary.validation_item_count);

      const searchIndexContracts = JSON.parse((await buildReviewApiResponse("/api/search-index-contracts?search_index_contract_status=complete", apiOptions)).body);
      assert.equal(searchIndexContracts.collection, "search_index_contracts");
      assert.equal(searchIndexContracts.count, 1);

      const searchIndexManifests = JSON.parse((await buildReviewApiResponse("/api/search-index-manifests?index_status=manifest_ready", apiOptions)).body);
      assert.equal(searchIndexManifests.collection, "search_index_manifests");
      assert.equal(searchIndexManifests.count, searchIndexContract.summary.search_index_manifest_count);

      const searchIndexFields = JSON.parse((await buildReviewApiResponse("/api/search-index-fields?field_role=required_filter", apiOptions)).body);
      assert.equal(searchIndexFields.collection, "search_index_fields");
      assert.equal(searchIndexFields.count, searchIndexContract.summary.required_filter_field_count);

      const searchIndexQueryPlans = JSON.parse((await buildReviewApiResponse("/api/search-index-query-plans?query_status=held_for_retrieval_filter_compiler", apiOptions)).body);
      assert.equal(searchIndexQueryPlans.collection, "search_index_query_plans");
      assert.equal(searchIndexQueryPlans.count, searchIndexContract.summary.search_index_query_plan_count);

      const searchIndexValidations = JSON.parse((await buildReviewApiResponse("/api/search-index-validations?status=passed", apiOptions)).body);
      assert.equal(searchIndexValidations.collection, "search_index_validations");
      assert.equal(searchIndexValidations.count, searchIndexContract.summary.validation_item_count);

      const matterContractFreezes = JSON.parse((await buildReviewApiResponse("/api/matter-contract-freezes?freeze_status=complete", apiOptions)).body);
      assert.equal(matterContractFreezes.collection, "matter_contract_freezes");
      assert.equal(matterContractFreezes.count, 1);

      const clientV2Contracts = JSON.parse((await buildReviewApiResponse("/api/client-v2-contracts?client_id=client.alpha", apiOptions)).body);
      assert.equal(clientV2Contracts.collection, "client_v2_contracts");
      assert.equal(clientV2Contracts.count, matterContractFreeze.summary.client_count);

      const partyV2Contracts = JSON.parse((await buildReviewApiResponse("/api/party-v2-contracts?party_type=counterparty", apiOptions)).body);
      assert.equal(partyV2Contracts.collection, "party_v2_contracts");
      assert.equal(partyV2Contracts.count, matterContractFreeze.summary.counterparty_count);

      const matterV2Contracts = JSON.parse((await buildReviewApiResponse("/api/matter-v2-contracts?matter_status=active", apiOptions)).body);
      assert.equal(matterV2Contracts.collection, "matter_v2_contracts");
      assert.equal(matterV2Contracts.count, matterContractFreeze.summary.matter_count);

      const matterTeamV2Contracts = JSON.parse((await buildReviewApiResponse("/api/matter-team-v2-contracts?team_status=active", apiOptions)).body);
      assert.equal(matterTeamV2Contracts.collection, "matter_team_v2_contracts");
      assert.equal(matterTeamV2Contracts.count, matterContractFreeze.summary.matter_team_count);

      const matterBoundaryV2Contracts = JSON.parse((await buildReviewApiResponse("/api/matter-boundary-v2-contracts?boundary_status=active", apiOptions)).body);
      assert.equal(matterBoundaryV2Contracts.collection, "matter_boundary_v2_contracts");
      assert.equal(matterBoundaryV2Contracts.count, matterContractFreeze.summary.matter_boundary_count);

      const matterContractValidations = JSON.parse((await buildReviewApiResponse("/api/matter-contract-validations?status=passed", apiOptions)).body);
      assert.equal(matterContractValidations.collection, "matter_contract_validations");
      assert.equal(matterContractValidations.count, matterContractFreeze.summary.validation_item_count);

      const clientCounterpartyRegistries = JSON.parse((await buildReviewApiResponse("/api/client-counterparty-registries?registry_status=complete", apiOptions)).body);
      assert.equal(clientCounterpartyRegistries.collection, "client_counterparty_registries");
      assert.equal(clientCounterpartyRegistries.count, 1);

      const partyRegistry = JSON.parse((await buildReviewApiResponse("/api/party-registry?party_type=client", apiOptions)).body);
      assert.equal(partyRegistry.collection, "party_registry");
      assert.equal(partyRegistry.count, matterContractFreeze.summary.client_party_count);

      const clientRegistry = JSON.parse((await buildReviewApiResponse("/api/client-registry?client_id=client.alpha", apiOptions)).body);
      assert.equal(clientRegistry.collection, "client_registry");
      assert.equal(clientRegistry.count, clientCounterpartyRegistry.summary.client_count);

      const counterpartyRegistry = JSON.parse((await buildReviewApiResponse("/api/counterparty-registry?counterparty_role=seller", apiOptions)).body);
      assert.equal(counterpartyRegistry.collection, "counterparty_registry");
      assert.equal(counterpartyRegistry.count, clientCounterpartyRegistry.summary.counterparty_count);

      const matterPartyLinks = JSON.parse((await buildReviewApiResponse("/api/matter-party-links?link_status=active", apiOptions)).body);
      assert.equal(matterPartyLinks.collection, "matter_party_links");
      assert.equal(matterPartyLinks.count, clientCounterpartyRegistry.summary.matter_party_link_count);

      const conflictReferenceIndex = JSON.parse((await buildReviewApiResponse("/api/conflict-reference-index?conflict_check_status=ready", apiOptions)).body);
      assert.equal(conflictReferenceIndex.collection, "conflict_reference_index");
      assert.equal(conflictReferenceIndex.count, clientCounterpartyRegistry.summary.conflict_reference_count);

      const clientCounterpartyValidations = JSON.parse((await buildReviewApiResponse("/api/client-counterparty-validations?status=passed", apiOptions)).body);
      assert.equal(clientCounterpartyValidations.collection, "client_counterparty_validations");
      assert.equal(clientCounterpartyValidations.count, clientCounterpartyRegistry.summary.validation_item_count);

      const matterProfileTeamLedgers = JSON.parse((await buildReviewApiResponse("/api/matter-profile-team-ledgers?ledger_status=complete", apiOptions)).body);
      assert.equal(matterProfileTeamLedgers.collection, "matter_profile_team_ledgers");
      assert.equal(matterProfileTeamLedgers.count, 1);

      const matterProfiles = JSON.parse((await buildReviewApiResponse("/api/matter-profiles?matter_id=matter.alpha.ldd", apiOptions)).body);
      assert.equal(matterProfiles.collection, "matter_profiles");
      assert.equal(matterProfiles.count, matterProfileTeamLedger.summary.matter_profile_count);

      const matterTeamRosters = JSON.parse((await buildReviewApiResponse("/api/matter-team-rosters?team_status=active", apiOptions)).body);
      assert.equal(matterTeamRosters.collection, "matter_team_rosters");
      assert.equal(matterTeamRosters.count, matterProfileTeamLedger.summary.matter_team_roster_count);

      const matterTeamMemberships = JSON.parse((await buildReviewApiResponse("/api/matter-team-memberships?membership_status=active", apiOptions)).body);
      assert.equal(matterTeamMemberships.collection, "matter_team_memberships");
      assert.equal(matterTeamMemberships.count, matterProfileTeamLedger.summary.active_team_membership_count);

      const matterAccessSubjects = JSON.parse((await buildReviewApiResponse("/api/matter-access-subjects?access_decision=allow", apiOptions)).body);
      assert.equal(matterAccessSubjects.collection, "matter_access_subjects");
      assert.equal(matterAccessSubjects.count, matterProfileTeamLedger.summary.allowed_access_subject_count);

      const matterProfileTeamValidations = JSON.parse((await buildReviewApiResponse("/api/matter-profile-team-validations?status=passed", apiOptions)).body);
      assert.equal(matterProfileTeamValidations.collection, "matter_profile_team_validations");
      assert.equal(matterProfileTeamValidations.count, matterProfileTeamLedger.summary.validation_item_count);

      const wallPolicyContracts = JSON.parse((await buildReviewApiResponse("/api/wall-policy-contracts?wall_policy_status=complete", apiOptions)).body);
      assert.equal(wallPolicyContracts.collection, "wall_policy_contracts");
      assert.equal(wallPolicyContracts.count, 1);

      const wallPolicyRules = JSON.parse((await buildReviewApiResponse("/api/wall-policy-rules?enforcement_stage=pre_retrieval", apiOptions)).body);
      assert.equal(wallPolicyRules.collection, "wall_policy_rules");
      assert.equal(wallPolicyRules.count, wallPolicyContract.summary.pre_retrieval_rule_count);

      const retrievalWallFilters = JSON.parse((await buildReviewApiResponse("/api/retrieval-wall-filters?filter_status=complete", apiOptions)).body);
      assert.equal(retrievalWallFilters.collection, "retrieval_wall_filters");
      assert.equal(retrievalWallFilters.count, wallPolicyContract.summary.complete_retrieval_wall_filter_count);

      const wallSubjectBindings = JSON.parse((await buildReviewApiResponse("/api/wall-subject-bindings?pre_retrieval_effect=allow", apiOptions)).body);
      assert.equal(wallSubjectBindings.collection, "wall_subject_bindings");
      assert.equal(wallSubjectBindings.count, wallPolicyContract.summary.allowed_wall_subject_binding_count);

      const conflictWallBindings = JSON.parse((await buildReviewApiResponse("/api/conflict-wall-bindings?conflict_check_status=ready", apiOptions)).body);
      assert.equal(conflictWallBindings.collection, "conflict_wall_bindings");
      assert.equal(conflictWallBindings.count, wallPolicyContract.summary.ready_conflict_wall_binding_count);

      const wallPolicyValidations = JSON.parse((await buildReviewApiResponse("/api/wall-policy-validations?status=passed", apiOptions)).body);
      assert.equal(wallPolicyValidations.collection, "wall_policy_validations");
      assert.equal(wallPolicyValidations.count, wallPolicyContract.summary.validation_item_count);

      const matterAccessPolicyEvaluators = JSON.parse((await buildReviewApiResponse("/api/matter-access-policy-evaluators?access_policy_status=complete", apiOptions)).body);
      assert.equal(matterAccessPolicyEvaluators.collection, "matter_access_policy_evaluators");
      assert.equal(matterAccessPolicyEvaluators.count, 1);

      const matterAccessPolicyRules = JSON.parse((await buildReviewApiResponse("/api/matter-access-policy-rules?enforcement_stage=pre_retrieval", apiOptions)).body);
      assert.equal(matterAccessPolicyRules.collection, "matter_access_policy_rules");
      assert.equal(matterAccessPolicyRules.count, matterAccessPolicyEvaluator.summary.access_policy_rule_count);

      const matterAccessDecisions = JSON.parse((await buildReviewApiResponse("/api/matter-access-decisions?access_decision=allow", apiOptions)).body);
      assert.equal(matterAccessDecisions.collection, "matter_access_decisions");
      assert.equal(matterAccessDecisions.count, matterAccessPolicyEvaluator.summary.matter_allow_decision_count);

      const resourceAccessDecisions = JSON.parse((await buildReviewApiResponse("/api/resource-access-decisions?access_decision=review", apiOptions)).body);
      assert.equal(resourceAccessDecisions.collection, "resource_access_decisions");
      assert.equal(resourceAccessDecisions.count, matterAccessPolicyEvaluator.summary.resource_review_decision_count);

      const runtimeAccessMatrix = JSON.parse((await buildReviewApiResponse("/api/runtime-access-matrix?runtime_id=harness", apiOptions)).body);
      assert.equal(runtimeAccessMatrix.collection, "runtime_access_matrix");
      assert.equal(runtimeAccessMatrix.count, 1);

      const matterAccessPolicyValidations = JSON.parse((await buildReviewApiResponse("/api/matter-access-policy-validations?status=passed", apiOptions)).body);
      assert.equal(matterAccessPolicyValidations.collection, "matter_access_policy_validations");
      assert.equal(matterAccessPolicyValidations.count, matterAccessPolicyEvaluator.summary.validation_item_count);

      const dataClassificationRuleEngines = JSON.parse((await buildReviewApiResponse("/api/data-classification-rule-engines", apiOptions)).body);
      assert.equal(dataClassificationRuleEngines.collection, "data_classification_rule_engines");
      assert.equal(dataClassificationRuleEngines.count, 1);

      const dataClassificationRules = JSON.parse((await buildReviewApiResponse("/api/data-classification-rules?external_model_decision=review", apiOptions)).body);
      assert.equal(dataClassificationRules.collection, "data_classification_rules");
      assert.equal(dataClassificationRules.count, 1);

      const resourceClassificationDecisions = JSON.parse((await buildReviewApiResponse("/api/resource-classification-decisions?resource_policy_decision=review", apiOptions)).body);
      assert.equal(resourceClassificationDecisions.collection, "resource_classification_decisions");
      assert.equal(resourceClassificationDecisions.count, dataClassificationRuleEngine.summary.review_decision_count);

      const classificationPolicyBindings = JSON.parse((await buildReviewApiResponse("/api/classification-policy-bindings?binding_status=complete", apiOptions)).body);
      assert.equal(classificationPolicyBindings.collection, "classification_policy_bindings");
      assert.equal(classificationPolicyBindings.count, dataClassificationRuleEngine.summary.classification_policy_binding_count);

      const dataClassificationRuleValidations = JSON.parse((await buildReviewApiResponse("/api/data-classification-rule-validations?status=passed", apiOptions)).body);
      assert.equal(dataClassificationRuleValidations.collection, "data_classification_rule_validations");
      assert.equal(dataClassificationRuleValidations.count, dataClassificationRuleEngine.summary.validation_item_count);

      const matterTaggingLedgers = JSON.parse((await buildReviewApiResponse("/api/matter-tagging-ledgers?matter_tagging_ledger_status=complete", apiOptions)).body);
      assert.equal(matterTaggingLedgers.collection, "matter_tagging_ledgers");
      assert.equal(matterTaggingLedgers.count, 1);

      const matterTaggingDecisions = JSON.parse((await buildReviewApiResponse("/api/matter-tagging-decisions?tagging_status=pending_human_confirmation", apiOptions)).body);
      assert.equal(matterTaggingDecisions.collection, "matter_tagging_decisions");
      assert.equal(matterTaggingDecisions.count, matterTaggingDecisionLedger.summary.pending_human_confirmation_count);

      const matterTaggingCandidates = JSON.parse((await buildReviewApiResponse("/api/matter-tagging-candidates?candidate_status=requires_human_confirmation", apiOptions)).body);
      assert.equal(matterTaggingCandidates.collection, "matter_tagging_candidates");
      assert.equal(matterTaggingCandidates.count, matterTaggingDecisionLedger.summary.automatic_candidate_count);

      const matterTaggingConfirmations = JSON.parse((await buildReviewApiResponse("/api/matter-tagging-confirmations?confirmation_status=pending", apiOptions)).body);
      assert.equal(matterTaggingConfirmations.collection, "matter_tagging_confirmations");
      assert.equal(matterTaggingConfirmations.count, matterTaggingDecisionLedger.summary.human_confirmation_request_count);

      const matterTaggingCorrections = JSON.parse((await buildReviewApiResponse("/api/matter-tagging-corrections", apiOptions)).body);
      assert.equal(matterTaggingCorrections.collection, "matter_tagging_corrections");
      assert.equal(matterTaggingCorrections.count, matterTaggingDecisionLedger.summary.correction_history_count);

      const matterTaggingValidations = JSON.parse((await buildReviewApiResponse("/api/matter-tagging-validations?status=passed", apiOptions)).body);
      assert.equal(matterTaggingValidations.collection, "matter_tagging_validations");
      assert.equal(matterTaggingValidations.count, matterTaggingDecisionLedger.summary.validation_item_count);

      const accessAuditProjections = JSON.parse((await buildReviewApiResponse("/api/access-audit-projections?access_audit_projection_status=complete", apiOptions)).body);
      assert.equal(accessAuditProjections.collection, "access_audit_projections");
      assert.equal(accessAuditProjections.count, 1);

      const accessAuditRecords = JSON.parse((await buildReviewApiResponse("/api/access-audit-records?target_type=resource&view_status=view_requires_human_confirmation", apiOptions)).body);
      assert.equal(accessAuditRecords.collection, "access_audit_records");
      assert.equal(accessAuditRecords.count, accessAuditProjection.summary.resource_audit_record_count);

      const accessAuditActorRollups = JSON.parse((await buildReviewApiResponse("/api/access-audit-actor-rollups?target_matter_id=matter.alpha.ldd", apiOptions)).body);
      assert.equal(accessAuditActorRollups.collection, "access_audit_actor_rollups");
      assert.equal(accessAuditActorRollups.count, accessAuditProjection.summary.actor_access_rollup_count);

      const accessAuditResourceRollups = JSON.parse((await buildReviewApiResponse("/api/access-audit-resource-rollups?target_matter_id=matter.alpha.ldd", apiOptions)).body);
      assert.equal(accessAuditResourceRollups.collection, "access_audit_resource_rollups");
      assert.equal(accessAuditResourceRollups.count, accessAuditProjection.summary.resource_access_rollup_count);

      const accessAuditValidations = JSON.parse((await buildReviewApiResponse("/api/access-audit-validations?status=passed", apiOptions)).body);
      assert.equal(accessAuditValidations.collection, "access_audit_validations");
      assert.equal(accessAuditValidations.count, accessAuditProjection.summary.validation_item_count);

      const storePolicyAdapters = JSON.parse((await buildReviewApiResponse("/api/store-policy-adapters?store_policy_adapter_status=complete", apiOptions)).body);
      assert.equal(storePolicyAdapters.collection, "store_policy_adapters");
      assert.equal(storePolicyAdapters.count, 1);

      const storePolicyRules = JSON.parse((await buildReviewApiResponse("/api/store-policy-rules?rule_type=matter_scope", apiOptions)).body);
      assert.equal(storePolicyRules.collection, "store_policy_rules");
      assert.equal(storePolicyRules.count, 1);

      const rlsFilterTemplates = JSON.parse((await buildReviewApiResponse("/api/rls-filter-templates?collection_id=resource_store", apiOptions)).body);
      assert.equal(rlsFilterTemplates.collection, "rls_filter_templates");
      assert.equal(rlsFilterTemplates.count, 1);

      const storeQueryPlans = JSON.parse((await buildReviewApiResponse("/api/store-query-plans?query_status=held_for_human_confirmation&target_type=resource", apiOptions)).body);
      assert.equal(storeQueryPlans.collection, "store_query_plans");
      assert.equal(storeQueryPlans.count, accessAuditProjection.summary.resource_audit_record_count);

      const storeEnforcementProbes = JSON.parse((await buildReviewApiResponse("/api/store-enforcement-probes?probe_type=unfiltered_query&observed_outcome=blocked", apiOptions)).body);
      assert.equal(storeEnforcementProbes.collection, "store_enforcement_probes");
      assert.equal(storeEnforcementProbes.count, storePolicyAdapter.summary.store_query_plan_count);

      const storePolicyValidations = JSON.parse((await buildReviewApiResponse("/api/store-policy-validations?status=passed", apiOptions)).body);
      assert.equal(storePolicyValidations.collection, "store_policy_validations");
      assert.equal(storePolicyValidations.count, storePolicyAdapter.summary.validation_item_count);

      const conflictCheckInterfaces = JSON.parse((await buildReviewApiResponse("/api/conflict-check-interfaces?conflict_check_interface_status=complete", apiOptions)).body);
      assert.equal(conflictCheckInterfaces.collection, "conflict_check_interfaces");
      assert.equal(conflictCheckInterfaces.count, 1);

      const resourceConflictCheckRequests = JSON.parse((await buildReviewApiResponse("/api/conflict-check-requests?request_type=resource_access", apiOptions)).body);
      assert.equal(resourceConflictCheckRequests.collection, "conflict_check_requests");
      assert.equal(resourceConflictCheckRequests.count, conflictCheckInterface.summary.resource_access_request_count);

      const reviewConflictCheckResults = JSON.parse((await buildReviewApiResponse("/api/conflict-check-results?result_status=review_required", apiOptions)).body);
      assert.equal(reviewConflictCheckResults.collection, "conflict_check_results");
      assert.equal(reviewConflictCheckResults.count, conflictCheckInterface.summary.review_required_result_count);

      const counterpartyConflictSignals = JSON.parse((await buildReviewApiResponse("/api/conflict-check-signals?signal_decision=review", apiOptions)).body);
      assert.equal(counterpartyConflictSignals.collection, "conflict_check_signals");
      assert.equal(counterpartyConflictSignals.count, conflictCheckInterface.summary.review_signal_count);

      const conflictCheckValidations = JSON.parse((await buildReviewApiResponse("/api/conflict-check-validations?status=passed", apiOptions)).body);
      assert.equal(conflictCheckValidations.collection, "conflict_check_validations");
      assert.equal(conflictCheckValidations.count, conflictCheckInterface.summary.validation_item_count);

      const personalWorkspaceBoundaries = JSON.parse((await buildReviewApiResponse("/api/personal-workspace-boundaries?personal_workspace_boundary_status=complete", apiOptions)).body);
      assert.equal(personalWorkspaceBoundaries.collection, "personal_workspace_boundaries");
      assert.equal(personalWorkspaceBoundaries.count, 1);

      const personalWorkspaceRows = JSON.parse((await buildReviewApiResponse("/api/workspace-boundaries?workspace_type=personal_project", apiOptions)).body);
      assert.equal(personalWorkspaceRows.collection, "workspace_boundaries");
      assert.equal(personalWorkspaceRows.count, personalWorkspaceBoundary.summary.personal_workspace_boundary_count);

      const tenantPolicyBoundaryRows = JSON.parse((await buildReviewApiResponse("/api/tenant-policy-boundaries?policy_mode=deny_unless_workspace_scoped", apiOptions)).body);
      assert.equal(tenantPolicyBoundaryRows.collection, "tenant_policy_boundaries");
      assert.equal(tenantPolicyBoundaryRows.count, personalWorkspaceBoundary.summary.tenant_policy_boundary_count);

      const searchNamespacePolicyRows = JSON.parse((await buildReviewApiResponse("/api/search-namespace-policies?query_scope_status=isolated", apiOptions)).body);
      assert.equal(searchNamespacePolicyRows.collection, "search_namespace_policies");
      assert.equal(searchNamespacePolicyRows.count, personalWorkspaceBoundary.summary.search_namespace_policy_count);

      const crossWorkspaceProbeRows = JSON.parse((await buildReviewApiResponse("/api/cross-workspace-probes?observed_outcome=blocked", apiOptions)).body);
      assert.equal(crossWorkspaceProbeRows.collection, "cross_workspace_probes");
      assert.equal(crossWorkspaceProbeRows.count, personalWorkspaceBoundary.summary.blocked_cross_workspace_probe_count);

      const personalWorkspaceBoundaryValidations = JSON.parse((await buildReviewApiResponse("/api/personal-workspace-boundary-validations?status=passed", apiOptions)).body);
      assert.equal(personalWorkspaceBoundaryValidations.collection, "personal_workspace_boundary_validations");
      assert.equal(personalWorkspaceBoundaryValidations.count, personalWorkspaceBoundary.summary.validation_item_count);

      const policyGoldenFixtureRows = JSON.parse((await buildReviewApiResponse("/api/policy-golden-fixtures?policy_golden_fixture_status=complete", apiOptions)).body);
      assert.equal(policyGoldenFixtureRows.collection, "policy_golden_fixtures");
      assert.equal(policyGoldenFixtureRows.count, 1);

      const policyReviewCaseRows = JSON.parse((await buildReviewApiResponse("/api/policy-fixture-cases?expected_decision=review", apiOptions)).body);
      assert.equal(policyReviewCaseRows.collection, "policy_fixture_cases");
      assert.equal(policyReviewCaseRows.count, policyGoldenFixtures.summary.review_case_count);

      const policyOutcomeMatrixRows = JSON.parse((await buildReviewApiResponse("/api/policy-outcome-matrix", apiOptions)).body);
      assert.equal(policyOutcomeMatrixRows.collection, "policy_outcome_matrix");
      assert.equal(policyOutcomeMatrixRows.count, 1);

      const policyRegressionHashRows = JSON.parse((await buildReviewApiResponse("/api/policy-regression-hashes?case_status=locked", apiOptions)).body);
      assert.equal(policyRegressionHashRows.collection, "policy_regression_hashes");
      assert.equal(policyRegressionHashRows.count, policyGoldenFixtures.summary.locked_regression_hash_count);

      const policyGoldenFixtureValidations = JSON.parse((await buildReviewApiResponse("/api/policy-golden-fixture-validations?status=passed", apiOptions)).body);
      assert.equal(policyGoldenFixtureValidations.collection, "policy_golden_fixture_validations");
      assert.equal(policyGoldenFixtureValidations.count, policyGoldenFixtures.summary.validation_item_count);

      const policyOperationSurfaces = JSON.parse((await buildReviewApiResponse("/api/policy-operation-surfaces?policy_operations_surface_status=complete", apiOptions)).body);
      assert.equal(policyOperationSurfaces.collection, "policy_operation_surfaces");
      assert.equal(policyOperationSurfaces.count, 1);

      const policyDecisionRows = JSON.parse((await buildReviewApiResponse("/api/policy-decision-rows?decision=deny", apiOptions)).body);
      assert.equal(policyDecisionRows.collection, "policy_decision_rows");
      assert.equal(policyDecisionRows.count, policyOperationsSurface.summary.deny_decision_count);

      const policyViolationRows = JSON.parse((await buildReviewApiResponse("/api/policy-violation-rows?severity=critical", apiOptions)).body);
      assert.equal(policyViolationRows.collection, "policy_violation_rows");
      assert.equal(policyViolationRows.count, policyOperationsSurface.summary.critical_violation_count);

      const policyPendingApprovals = JSON.parse((await buildReviewApiResponse("/api/policy-pending-approvals?required_actor=human_reviewer", apiOptions)).body);
      assert.equal(policyPendingApprovals.collection, "policy_pending_approvals");
      assert.ok(policyPendingApprovals.count > 0);

      const policySurfaceValidations = JSON.parse((await buildReviewApiResponse("/api/policy-surface-validations?status=passed", apiOptions)).body);
      assert.equal(policySurfaceValidations.collection, "policy_surface_validations");
      assert.equal(policySurfaceValidations.count, policyOperationsSurface.summary.validation_item_count);

      const matterBoundarySlices = JSON.parse((await buildReviewApiResponse("/api/matter-boundary-slices?matter_boundary_slice_status=complete", apiOptions)).body);
      assert.equal(matterBoundarySlices.collection, "matter_boundary_slices");
      assert.equal(matterBoundarySlices.count, 1);

      const matterBoundaryResourcePaths = JSON.parse((await buildReviewApiResponse("/api/matter-boundary-resource-paths?boundary_status=held_for_matter_tagging", apiOptions)).body);
      assert.equal(matterBoundaryResourcePaths.collection, "matter_boundary_resource_paths");
      assert.equal(matterBoundaryResourcePaths.count, matterBoundarySlice.summary.held_for_matter_tagging_resource_count);

      const matterBoundaryRetrievalGates = JSON.parse((await buildReviewApiResponse("/api/matter-boundary-retrieval-gates?retrieval_gate_status=passed", apiOptions)).body);
      assert.equal(matterBoundaryRetrievalGates.collection, "matter_boundary_retrieval_gates");
      assert.equal(matterBoundaryRetrievalGates.count, matterBoundarySlice.summary.passed_retrieval_gate_check_count);

      const matterBoundaryValidations = JSON.parse((await buildReviewApiResponse("/api/matter-boundary-validations?status=passed", apiOptions)).body);
      assert.equal(matterBoundaryValidations.collection, "matter_boundary_validations");
      assert.equal(matterBoundaryValidations.count, matterBoundarySlice.summary.validation_item_count);

      const identityPolicyMatterFreezes = JSON.parse((await buildReviewApiResponse("/api/identity-policy-matter-freezes?freeze_status=frozen_with_pending_human_actions", apiOptions)).body);
      assert.equal(identityPolicyMatterFreezes.collection, "identity_policy_matter_freezes");
      assert.equal(identityPolicyMatterFreezes.count, 1);

      const identityPolicyFreezeSources = JSON.parse((await buildReviewApiResponse("/api/identity-policy-freeze-sources?source_status=passed", apiOptions)).body);
      assert.equal(identityPolicyFreezeSources.collection, "identity_policy_freeze_sources");
      assert.equal(identityPolicyFreezeSources.count, identityPolicyMatterFreeze.summary.required_source_count);

      const identityPolicyFreezeCheckpoints = JSON.parse((await buildReviewApiResponse("/api/identity-policy-freeze-checkpoints?status=passed", apiOptions)).body);
      assert.equal(identityPolicyFreezeCheckpoints.collection, "identity_policy_freeze_checkpoints");
      assert.equal(identityPolicyFreezeCheckpoints.count, identityPolicyMatterFreeze.summary.passed_freeze_checkpoint_count);

      const identityPolicyFreezeValidations = JSON.parse((await buildReviewApiResponse("/api/identity-policy-freeze-validations?status=passed", apiOptions)).body);
      assert.equal(identityPolicyFreezeValidations.collection, "identity_policy_freeze_validations");
      assert.equal(identityPolicyFreezeValidations.count, identityPolicyMatterFreeze.summary.passed_freeze_checkpoint_count);

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
