import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildDealControlBrief, renderDealControlBrief } from "../src/deal-control.mjs";
import { buildDevProjectBrief, readDevProjectsFile, renderDevProjectBrief, validateDevProjects } from "../src/dev-projects.mjs";
import { extractIntakeCandidates, mergeCandidatesIntoMatter } from "../src/intake-adapter.mjs";
import { parseKakaoTalkExport } from "../src/kakao-parser.mjs";
import { buildLitigationMatrix, renderLitigationMatrix } from "../src/litigation-matrix.mjs";
import { buildMatterBrief, readMatterFile, renderMatterBrief, validateMatter } from "../src/matter-harness.mjs";
import { parseOutlookEml, parseOutlookJson } from "../src/outlook-parser.mjs";
import { runApprovalDecisions } from "../src/approval-decisions.mjs";
import { runApprovalQueue } from "../src/approval-queue.mjs";
import { runEvidenceViewer } from "../src/evidence-viewer.mjs";
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

      const personalDevSummaryPath = path.join(outDir, "personal-dev-summary.json");
      await writeFile(
        personalDevSummaryPath,
        JSON.stringify(
          {
            status: "blocked",
            blocked_reason: "merge_approval_pending",
            actual_isolation: "git_worktree",
            approval_id: "approval.test.merge",
            workflow_run_id: "workflow-run.test.personal_dev",
          },
          null,
          2,
        ),
        "utf8",
      );
      const dashboard = await runReviewDashboard({
        resourceExpansionPath: path.join(outDir, "resource-expansion-job.json"),
        resourceIngestPath: path.join(outDir, "ingest", "resource-ingest.json"),
        evidenceViewerPath: path.join(outDir, "viewer", "evidence-viewer.json"),
        approvalQueuePath: path.join(outDir, "approval-queue", "approval-queue.json"),
        approvalDecisionPath: path.join(outDir, "approval-decisions", "approval-decision-result.json"),
        personalDevSummaryPath,
        outDir: path.join(outDir, "dashboard"),
        runAt: "2026-05-23T06:35:00.000Z",
      });
      const dashboardSchema = JSON.parse(await readFile("schemas/review-dashboard.schema.json", "utf8"));
      assert.deepEqual(validateAgainstSchema(dashboard, dashboardSchema, {}, "review_dashboard"), []);
      assert.equal(dashboard.summary.overall_status, "blocked");
      assert.equal(dashboard.summary.evidence_approved_count, 1);
      assert.equal(dashboard.summary.pending_approval_count, 0);
      assert.ok(dashboard.summary.action_item_count >= 1);
      assert.match(await readFile(path.join(outDir, "dashboard", "index.html"), "utf8"), /Hermes Review Dashboard/);
      assert.match(await readFile(path.join(outDir, "dashboard", "summary.md"), "utf8"), /Action Items/);
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
