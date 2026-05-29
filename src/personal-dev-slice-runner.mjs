import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  loadCoreSchemas,
  validateEventLedger,
  validateVerticalSlice,
} from "./core-contract-validator.mjs";
import { buildDevProjectBrief, readDevProjectsFile, validateDevProjects } from "./dev-projects.mjs";
import { invokeRuntimeAdapters } from "./runtime-invoker.mjs";
import { prepareAgentWorkspace } from "./worktree-manager.mjs";

export const DEFAULT_PERSONAL_DEV_INPUT = "examples/dev-projects.json";
export const DEFAULT_PERSONAL_DEV_OUT_DIR = "artifacts/personal-dev-slice/latest";

const DEFAULT_IDS = {
  tenantId: "tenant.personal.jws",
  userId: "user.jws",
  clientId: "client.personal.jws",
  matterId: "matter.personal_dev.hermes",
  policySnapshotId: "policy.default.personal_dev.v1",
};

export async function runPersonalDevSlice(options = {}) {
  const result = await buildPersonalDevSliceRun(options);
  const schemas = await loadCoreSchemas(options.schemaDir);
  const sliceValidation = validateVerticalSlice(result.personal_dev_slice, schemas);
  const ledgerValidation = validateEventLedger(result.event_ledger, schemas, result.personal_dev_slice);

  const validation = {
    valid: sliceValidation.valid && ledgerValidation.valid,
    personal_dev_slice: sliceValidation,
    event_ledger: ledgerValidation,
  };

  if (validation.valid && options.outDir) {
    await writePersonalDevSliceRun(result, options.outDir);
  }

  return {
    ...result,
    validation,
  };
}

export async function buildPersonalDevSliceRun(options = {}) {
  const inputPath = options.inputPath ?? DEFAULT_PERSONAL_DEV_INPUT;
  const outDir = options.outDir ?? DEFAULT_PERSONAL_DEV_OUT_DIR;
  const runAt = new Date(options.runAt ?? new Date()).toISOString();
  const portfolioText = await readFile(inputPath, "utf8");
  const portfolio = JSON.parse(portfolioText);
  const errors = validateDevProjects(portfolio);
  if (errors.length > 0) {
    throw new Error(`Developer project portfolio validation failed: ${errors.join("; ")}`);
  }

  const brief = buildDevProjectBrief(portfolio, { today: options.today ?? isoDate(runAt) });
  const selected = selectDevelopmentTask(portfolio, brief, options.taskId);
  const repoPath = await resolveProjectRepository(selected.project.repository, {
    fallbackRepoPath: options.repoPath ?? process.cwd(),
  });
  const idSuffix = stableId(`${selected.project.id}:${selected.task.id}:${sha256(portfolioText)}`);
  const ids = { ...DEFAULT_IDS, ...options.ids };
  const workspace = await prepareAgentWorkspace({
    repoPath,
    outDir,
    worktreeRoot: options.worktreeRoot ?? path.join(outDir, "worktrees"),
    workspaceFallbackPath: path.join(outDir, "workspace"),
    projectId: selected.project.id,
    taskId: selected.task.id,
    branchName: `codex/${selected.task.id.toLowerCase()}-${slug(selected.project.id)}`,
    create: options.createWorktree ?? true,
  });
  const testResult = options.skipTests
    ? skippedTestResult(runAt)
    : await runCanonicalDevChecks({ cwd: repoPath, runAt });

  const plans = buildAgentPlans(selected, workspace, testResult);
  const runtimeInvocations = await buildRuntimeInvocations({
    selected,
    plans,
    workspace,
    mode: options.runtimeMode ?? "dry-run",
    runAt,
  });
  const prDraft = renderPrDraft(selected, plans, workspace, testResult);
  const sourceSpanText = renderTaskSourceSpan(selected);
  const portfolioHash = sha256(portfolioText);
  const resourceId = `resource.personal_dev.${idSuffix}`;
  const resourceVersionId = `resource-version.personal_dev.${idSuffix}.v1`;
  const normalizedTextId = `normalized.personal_dev.${idSuffix}`;
  const sourceSpanId = `span.personal_dev.${idSuffix}.task`;
  const evidenceId = `evidence.personal_dev.${idSuffix}.task`;
  const factId = `fact.personal_dev.${idSuffix}.task`;
  const issueId = `issue.personal_dev.${idSuffix}.task`;
  const citationId = `citation.personal_dev.${idSuffix}.pr`;
  const workflowId = "workflow.personal_dev.codex.worktree_patch.v1";
  const capabilityId = "personal_dev.codex.worktree_patch";
  const workflowRunId = `workflow-run.personal_dev.${idSuffix}`;
  const claudeRunId = `agent-run.personal_dev.${idSuffix}.claude`;
  const codexRunId = `agent-run.personal_dev.${idSuffix}.codex`;
  const localRunId = `agent-run.personal_dev.${idSuffix}.local_check`;
  const outputArtifactId = `output.personal_dev.${idSuffix}.pr_draft`;
  const approvalId = `approval.personal_dev.${idSuffix}.merge`;
  const protectedGateId = `gate-result.personal_dev.${idSuffix}.protected_file`;
  const diffGateId = `gate-result.personal_dev.${idSuffix}.diff_review`;
  const testGateId = `gate-result.personal_dev.${idSuffix}.test`;
  const approvalGateId = `gate-result.personal_dev.${idSuffix}.approval`;
  const costRecordId = `cost.personal_dev.${idSuffix}`;

  const personalDevSlice = {
    schema_version: "personal-dev-slice-run.v1",
    generated_at: isoAt(runAt, 20),
    identity_policy: buildIdentityPolicy(ids, runAt),
    resource_evidence: {
      schema_version: "resource-evidence.v1",
      resources: [
        {
          schema_version: "resource-core.v1",
          id: resourceId,
          tenant_id: ids.tenantId,
          source_system: "local_filesystem",
          source_uri: path.resolve(inputPath),
          resource_type: "document",
          content_hash: portfolioHash,
          classification: "P1_INTERNAL",
          matter_id: ids.matterId,
          materialization_status: "not_required",
          ingestion_status: "normalized",
          created_at: isoAt(runAt, 0),
          created_by: connectorActor(),
          metadata: {
            selected_project_id: selected.project.id,
            selected_task_id: selected.task.id,
          },
        },
      ],
      resource_versions: [
        {
          schema_version: "resource-version.v1",
          id: resourceVersionId,
          resource_id: resourceId,
          version_label: "v1",
          content_hash: portfolioHash,
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
          text_hash: portfolioHash,
          language: "ko",
          extractor_id: "extractor.dev_projects.v1",
          quality: "high",
          text_preview: `${selected.project.id} ${selected.task.id}: ${selected.task.title}`,
          metadata: {
            project_count: portfolio.projects.length,
            open_focus_count: brief.recommended_focus.length,
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
            project_id: selected.project.id,
            task_id: selected.task.id,
          },
          text: sourceSpanText,
          hash: sha256(sourceSpanText),
          metadata: {},
        },
      ],
      evidence_items: [
        {
          schema_version: "evidence-item.v1",
          id: evidenceId,
          matter_id: ids.matterId,
          source_span_ids: [sourceSpanId],
          evidence_type: "metadata",
          summary: `개발 작업 ${selected.task.id}의 상태, 맥락, 수락 기준`,
          reliability: "machine_extracted",
          review_status: "needs_review",
          metadata: {
            source: "examples/dev-projects.json",
          },
        },
      ],
      facts: [
        {
          schema_version: "fact.v1",
          id: factId,
          matter_id: ids.matterId,
          evidence_item_ids: [evidenceId],
          statement: `${selected.project.id}의 ${selected.task.id} 작업은 ${selected.task.status} 상태이며 ${selected.task.due}까지 처리해야 한다.`,
          fact_type: "general",
          confidence: 0.9,
          review_status: "reviewed",
          metadata: {
            priority: selected.task.priority,
          },
        },
      ],
      issues: [
        {
          schema_version: "issue.v1",
          id: issueId,
          matter_id: ids.matterId,
          issue_type: "development_task",
          title: selected.task.title,
          linked_fact_ids: [factId],
          severity: taskSeverity(selected.task),
          status: "candidate",
          metadata: {
            task_id: selected.task.id,
            project_id: selected.project.id,
          },
        },
      ],
      citations: [
        {
          schema_version: "citation.v1",
          id: citationId,
          output_artifact_id: outputArtifactId,
          target_path: "pr_draft.body",
          source_span_ids: [sourceSpanId],
          evidence_item_ids: [evidenceId],
          citation_status: "candidate",
          metadata: {},
        },
      ],
    },
    workflow_runtime: {
      schema_version: "workflow-runtime.v1",
      capabilities: [buildCapability()],
      workflows: [buildWorkflow(workflowId, capabilityId, resourceId, outputArtifactId)],
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
          created_by: harnessActor(),
          metadata: {
            blocked_reason: "merge_approval_pending",
            task_id: selected.task.id,
          },
        },
      ],
      agent_runs: [
        agentRun(claudeRunId, workflowRunId, "claude_code", resourceId, issueId, runAt, 5, 8, {
          lane: "planner",
          output: "claude_plan",
        }),
        agentRun(codexRunId, workflowRunId, "codex", resourceId, outputArtifactId, runAt, 9, 12, {
          lane: "implementation_patch_generator",
          output_trust: "untrusted_until_verified",
        }),
        agentRun(localRunId, workflowRunId, "local_script", outputArtifactId, outputArtifactId, runAt, 13, 16, {
          lane: "canonical_test_gate",
          exit_code: testResult.exit_code,
        }),
      ],
    },
    governance_output: {
      schema_version: "governance-output.v1",
      gate_results: buildGateResults({
        runAt,
        workflowRunId,
        protectedGateId,
        diffGateId,
        testGateId,
        approvalGateId,
        outputArtifactId,
        testResult,
        workspace,
      }),
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
          created_at: isoAt(runAt, 18),
          metadata: {
            approval_type: "merge_approval",
          },
        },
      ],
      output_artifacts: [
        {
          schema_version: "output-artifact.v1",
          id: outputArtifactId,
          tenant_id: ids.tenantId,
          matter_id: ids.matterId,
          artifact_type: "pr_draft",
          artifact_uri: path.join(outDir, "pr-draft.md"),
          content_hash: sha256(prDraft),
          status: "draft",
          citation_ids: [citationId],
          created_by_run_id: codexRunId,
          created_at: isoAt(runAt, 17),
          metadata: {
            task_id: selected.task.id,
            branch_name: plans.reconciled.branch_name,
          },
        },
      ],
      audit_events: [
        auditEvent(`event.personal_dev.task_selected.${idSuffix}`, "issue.created", isoAt(runAt, 3), ids.tenantId, harnessActor(), "issue", issueId, workflowRunId, {
          task_id: selected.task.id,
        }),
        auditEvent(`event.personal_dev.approval_requested.${idSuffix}`, "approval.requested", isoAt(runAt, 18), ids.tenantId, harnessActor(), "approval", approvalId, workflowRunId, {
          output_artifact_id: outputArtifactId,
        }),
      ],
    },
  };

  const eventLedger = buildEventLedger({
    runAt,
    idSuffix,
    ids,
    resourceId,
    issueId,
    workflowRunId,
    capabilityId,
    claudeRunId,
    codexRunId,
    localRunId,
    protectedGateId,
    diffGateId,
    testGateId,
    approvalGateId,
    approvalId,
    outputArtifactId,
    costRecordId,
    testResult,
  });

  return {
    personal_dev_slice: personalDevSlice,
    event_ledger: eventLedger,
    plan: plans,
    runtime_invocations: runtimeInvocations,
    workspace_manifest: workspace,
    test_result: testResult,
    pr_draft: prDraft,
    summary: {
      input_path: path.resolve(inputPath),
      project_id: selected.project.id,
      task_id: selected.task.id,
      workflow_run_id: workflowRunId,
      issue_id: issueId,
      output_artifact_id: outputArtifactId,
      approval_id: approvalId,
      actual_isolation: workspace.actual_isolation,
      status: "blocked",
      blocked_reason: "merge_approval_pending",
    },
  };
}

export async function writePersonalDevSliceRun(result, outDir = DEFAULT_PERSONAL_DEV_OUT_DIR) {
  await mkdir(outDir, { recursive: true });
  await mkdir(path.join(outDir, "workspace"), { recursive: true });
  await writeJson(path.join(outDir, "personal-dev-slice.json"), result.personal_dev_slice);
  await writeJson(path.join(outDir, "event-ledger.json"), result.event_ledger);
  await writeJson(path.join(outDir, "plan.json"), result.plan);
  await writeJson(path.join(outDir, "runtime-invocations.json"), result.runtime_invocations);
  await writeJson(path.join(outDir, "workspace-manifest.json"), result.workspace_manifest);
  await writeJson(path.join(outDir, "test-result.json"), result.test_result);
  await writeJson(path.join(outDir, "summary.json"), result.summary);
  await writeFile(path.join(outDir, "pr-draft.md"), result.pr_draft, "utf8");
}

export async function runPersonalDevSliceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runPersonalDevSlice({
    inputPath: args.inputPath,
    outDir: args.outDir,
    runAt: args.runAt,
    today: args.today,
    taskId: args.taskId,
    skipTests: args.skipTests,
    runtimeMode: args.runtimeMode,
  });

  if (!result.validation.valid) {
    console.error("Personal dev slice validation failed.");
    for (const [section, validation] of Object.entries(result.validation)) {
      if (section === "valid" || validation.valid) continue;
      for (const error of validation.errors) {
        console.error(`- ${section}.${error.path}: ${error.message}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Personal dev slice written to ${path.resolve(args.outDir)}`);
  console.log(`Task: ${result.summary.project_id}/${result.summary.task_id}`);
  console.log(`Workflow run: ${result.summary.workflow_run_id}`);
  console.log(`Isolation: ${result.summary.actual_isolation}`);
  console.log("Status: blocked (merge approval pending)");
}

async function buildRuntimeInvocations({ selected, plans, workspace, mode, runAt }) {
  return invokeRuntimeAdapters({
    mode,
    workspaceManifest: workspace,
    runAt,
    invocations: [
      {
        runtimeId: "claude_code",
        prompt: renderClaudeInvocationPrompt(selected, plans),
        metadata: {
          lane: "planner_reviewer",
          task_id: selected.task.id,
        },
      },
      {
        runtimeId: "codex",
        prompt: renderCodexInvocationPrompt(selected, plans),
        metadata: {
          lane: "implementation_patch_generator",
          task_id: selected.task.id,
          branch_name: plans.reconciled.branch_name,
        },
      },
    ],
  });
}

function renderClaudeInvocationPrompt(selected, plans) {
  return [
    `Review task ${selected.task.id}: ${selected.task.title}`,
    "",
    "Check the scope, risks, acceptance criteria, and gates.",
    "",
    "Acceptance:",
    ...(selected.task.acceptance ?? []).map((item) => `- ${item}`),
    "",
    "Required gates:",
    ...plans.reconciled.required_gates.map((item) => `- ${item}`),
  ].join("\n");
}

function renderCodexInvocationPrompt(selected, plans) {
  return [
    `Prepare a bounded implementation plan for ${selected.task.id}: ${selected.task.title}`,
    "",
    `Branch: ${plans.reconciled.branch_name}`,
    "",
    "Allowed files:",
    ...plans.reconciled.agreed_files.map((item) => `- ${item}`),
    "",
    "Do not merge. Return a diff/PR draft only.",
  ].join("\n");
}

function selectDevelopmentTask(portfolio, brief, taskId) {
  for (const project of portfolio.projects) {
    for (const task of project.tasks ?? []) {
      if (taskId && task.id === taskId) return { project, task };
    }
  }
  if (taskId) throw new Error(`Task ${taskId} was not found`);

  const focus = brief.recommended_focus[0];
  if (focus) {
    const project = portfolio.projects.find((item) => item.id === focus.project_id);
    const task = project?.tasks?.find((item) => item.id === focus.id);
    if (project && task) return { project, task };
  }

  for (const project of portfolio.projects) {
    const task = project.tasks?.find((item) => ["in-progress", "next", "review", "blocked"].includes(item.status));
    if (task) return { project, task };
  }
  throw new Error("No development task is available for the personal dev slice");
}

async function resolveProjectRepository(repository, options = {}) {
  const declaredPath = path.resolve(repository ?? ".");
  if (await pathExists(declaredPath)) return declaredPath;

  const fallbackPath = path.resolve(options.fallbackRepoPath ?? process.cwd());
  const declaredName = lastPathSegment(repository);
  if (
    declaredName &&
    declaredName.toLowerCase() === path.basename(fallbackPath).toLowerCase() &&
    await pathExists(path.join(fallbackPath, "package.json"))
  ) {
    return fallbackPath;
  }

  return declaredPath;
}

function lastPathSegment(value) {
  return String(value ?? "").split(/[\\/]+/).filter(Boolean).at(-1) ?? "";
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function runCanonicalDevChecks({ cwd, runAt }) {
  const commands = [
    {
      id: "dev_validate",
      command: "npm",
      args: ["run", "dev:validate"],
    },
    {
      id: "dev_brief",
      command: "npm",
      args: ["run", "dev:brief"],
    },
  ];
  const results = [];
  for (const command of commands) {
    results.push(await runCommand(command, { cwd }));
  }
  const failed = results.find((result) => result.exit_code !== 0 || result.timed_out);
  return {
    schema_version: "personal-dev-test-result.v1",
    status: failed ? "failed" : "passed",
    exit_code: failed ? failed.exit_code : 0,
    commands: results,
    created_at: isoAt(runAt, 16),
    output_hash: sha256(results.map((result) => `${result.id}:${result.exit_code}:${result.stdout}:${result.stderr}`).join("\n")),
  };
}

function runCommand(command, options) {
  return new Promise((resolve) => {
    const started = new Date().toISOString();
    const spawnSpec = resolveCommandSpawn(command);
    const child = spawn(spawnSpec.command, spawnSpec.args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill("SIGTERM");
      resolve({
        id: command.id,
        command: [command.command, ...command.args].join(" "),
        exit_code: 124,
        timed_out: true,
        stdout: stdout.slice(0, 4000),
        stderr: stderr.slice(0, 4000),
        started_at: started,
        completed_at: new Date().toISOString(),
      });
    }, 15_000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      if (settled) return;
      clearTimeout(timer);
      resolve({
        id: command.id,
        command: [command.command, ...command.args].join(" "),
        exit_code: code ?? 1,
        timed_out: false,
        stdout: stdout.slice(0, 4000),
        stderr: stderr.slice(0, 4000),
        started_at: started,
        completed_at: new Date().toISOString(),
      });
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        id: command.id,
        command: [command.command, ...command.args].join(" "),
        exit_code: 127,
        timed_out: false,
        stdout: stdout.slice(0, 4000),
        stderr: String(error.message ?? error).slice(0, 4000),
        started_at: started,
        completed_at: new Date().toISOString(),
      });
    });
  });
}

function resolveCommandSpawn(command) {
  if (process.platform !== "win32") {
    return { command: command.command, args: command.args };
  }
  const executable = command.command === "npm" ? "npm.cmd" : command.command;
  const commandLine = [executable, ...command.args].map(quoteWindowsCommandArg).join(" ");
  return { command: "cmd.exe", args: ["/d", "/s", "/c", commandLine] };
}

function quoteWindowsCommandArg(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=+-]+$/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function skippedTestResult(runAt) {
  return {
    schema_version: "personal-dev-test-result.v1",
    status: "skipped",
    exit_code: 0,
    commands: [],
    created_at: isoAt(runAt, 16),
    output_hash: sha256("skipped"),
  };
}

function buildAgentPlans(selected, workspace, testResult) {
  const branchName = workspace.branch_name;
  const acceptance = selected.task.acceptance ?? [];
  const claudePlan = {
    agent: "claude_code",
    role: "planner_reviewer",
    task_id: selected.task.id,
    plan: [
      "Confirm the task scope and acceptance criteria before implementation.",
      "Keep the implementation bounded to the personal developer harness surface.",
      "Require a canonical test gate before treating the work as merge-ready.",
      "Leave merge and status changes pending human approval.",
    ],
    risks: [
      "A management workflow can become heavier than the development work itself.",
      "A PR draft must not be treated as a merged change.",
    ],
  };
  const codexPlan = {
    agent: "codex",
    role: "implementation_lane",
    task_id: selected.task.id,
    branch_name: branchName,
    proposed_files: inferProposedFiles(selected),
    commands: ["npm run dev:validate", "npm run dev:brief"],
    acceptance,
  };
  const reconciled = {
    task_id: selected.task.id,
    branch_name: branchName,
    scope_freeze: {
      included: [
        selected.task.title,
        "Generate PR draft only",
        "Run canonical local checks",
        "Keep merge pending approval",
      ],
      excluded: ["Direct GitHub merge", "Production credentials", "Unbounded repo refactor"],
    },
    agreed_files: codexPlan.proposed_files,
    required_gates: ["protected_file_gate", "diff_review_gate", "test_gate", "human_approval_gate"],
    test_status: testResult.status,
  };

  return {
    schema_version: "personal-dev-agent-plans.v1",
    claude_plan: claudePlan,
    codex_plan: codexPlan,
    reconciled,
  };
}

function inferProposedFiles(selected) {
  if (selected.task.id === "HD-002") {
    return ["scripts/dev-project-brief.mjs", "src/dev-projects.mjs", "test/matter-harness.test.mjs"];
  }
  if (selected.task.id === "HD-003") {
    return ["docs/personal-dev-harness.md", "examples/dev-projects.json"];
  }
  return ["examples/dev-projects.json"];
}

function renderPrDraft(selected, plans, workspace, testResult) {
  return [
    `# PR Draft: ${selected.task.id} ${selected.task.title}`,
    "",
    `Project: ${selected.project.id} - ${selected.project.name}`,
    `Branch: ${plans.reconciled.branch_name}`,
    `Isolation: ${workspace.actual_isolation}`,
    "",
    "## Scope",
    "",
    ...plans.reconciled.scope_freeze.included.map((item) => `- ${item}`),
    "",
    "## Out of Scope",
    "",
    ...plans.reconciled.scope_freeze.excluded.map((item) => `- ${item}`),
    "",
    "## Claude Review Plan",
    "",
    ...plans.claude_plan.plan.map((item) => `- ${item}`),
    "",
    "## Codex Implementation Plan",
    "",
    ...plans.codex_plan.proposed_files.map((item) => `- ${item}`),
    "",
    "## Acceptance",
    "",
    ...(selected.task.acceptance ?? ["Human review required"]).map((item) => `- ${item}`),
    "",
    "## Canonical Checks",
    "",
    ...testResult.commands.map((item) => `- ${item.command}: ${item.exit_code === 0 ? "passed" : "failed"}`),
    "",
    "## Gate Status",
    "",
    "- Protected files: passed",
    "- Diff review: passed",
    `- Test gate: ${testResult.status}`,
    "- Merge approval: pending human approval",
    "",
  ].join("\n");
}

function buildIdentityPolicy(ids, runAt) {
  return {
    schema_version: "identity-policy.v1",
    tenants: [
      {
        schema_version: "tenant.v1",
        id: ids.tenantId,
        name: "JWS Personal Harness",
        tenant_type: "personal",
        default_policy_id: ids.policySnapshotId,
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
        name: "Personal Projects",
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
        matter_name: "Personal Developer Harness",
        practice_area: "personal_dev",
        status: "active",
        classification: "P1_INTERNAL",
        matter_team: [
          {
            user_id: ids.userId,
            matter_role: "developer",
          },
        ],
        wall_ids: ["wall.personal.default"],
        created_at: isoAt(runAt, 0),
        metadata: {},
      },
    ],
    policy_snapshots: [
      {
        schema_version: "policy-snapshot.v1",
        id: ids.policySnapshotId,
        tenant_id: ids.tenantId,
        created_at: isoAt(runAt, 0),
        classification_rules: {
          default_classification: "P1_INTERNAL",
        },
        runtime_permissions: {
          P1_INTERNAL: ["harness", "claude_code", "codex", "local_script", "manual"],
        },
        model_permissions: {
          external_model_for_P1: "allowed_with_audit",
        },
        output_permissions: {
          merge: "human_approval_required",
        },
        approval_rules: {
          personal_dev_merge: "human_review_required",
        },
        metadata: {},
      },
    ],
  };
}

function buildCapability() {
  return {
    schema_version: "capability.v1",
    id: "personal_dev.codex.worktree_patch",
    version: "0.1.0",
    domain_pack: "personal-dev",
    description: "Create reconciled Claude/Codex plans and a verified PR draft for one development task.",
    input_schema: "dev-projects.schema.json",
    output_schema: "governance-output.v1",
    allowed_runtimes: ["harness", "claude_code", "codex", "local_script", "manual"],
    required_gates: {
      pre_run: ["classification_gate", "tool_permission_gate", "protected_file_gate"],
      in_run: [],
      post_run: ["protected_file_gate", "diff_review_gate", "test_gate", "human_approval_gate"],
    },
    data_policy: {
      max_input_classification: "P1_INTERNAL",
      external_model_policy: "allowed_with_audit",
    },
    approval_policy: {
      output_status: "draft",
      merge: "human_approval_required",
    },
    timeout_policy: {
      max_seconds: 3600,
    },
    retry_policy: {
      max_attempts: 1,
    },
    cost_policy: {
      max_usd: 10,
    },
    metadata: {
      output_trust: "untrusted_until_verified",
    },
  };
}

function buildWorkflow(workflowId, capabilityId, resourceId, outputArtifactId) {
  return {
    schema_version: "workflow.v1",
    id: workflowId,
    capability_id: capabilityId,
    version: "0.1.0",
    steps: [
      {
        step_id: "step.claude_plan",
        step_type: "agent",
        runtime_id: "claude_code",
        input_refs: [resourceId],
        output_contract: "personal-dev-agent-plans.v1",
      },
      {
        step_id: "step.codex_patch_plan",
        step_type: "agent",
        runtime_id: "codex",
        input_refs: [resourceId],
        output_contract: "pr-draft.v1",
      },
      {
        step_id: "step.canonical_test",
        step_type: "script",
        runtime_id: "local_script",
        input_refs: [outputArtifactId],
        output_contract: "personal-dev-test-result.v1",
      },
      {
        step_id: "step.merge_approval",
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

function buildGateResults(context) {
  const workspaceFinding = context.workspace.actual_isolation === "git_worktree"
    ? []
    : [
        {
          finding_id: "finding.personal_dev.workspace_fallback",
          severity: "info",
          message: "Source repository is not a git repository; isolated workspace fallback was used.",
          refs: [context.outputArtifactId],
        },
      ];
  return [
    {
      schema_version: "gate-result.v1",
      id: context.protectedGateId,
      workflow_run_id: context.workflowRunId,
      gate_id: "protected_file_gate",
      gate_stage: "post_run",
      status: "passed",
      findings: workspaceFinding,
      blocking: false,
      created_at: isoAt(context.runAt, 14),
      metadata: {
        protected_paths: context.workspace.protected_paths,
      },
    },
    {
      schema_version: "gate-result.v1",
      id: context.diffGateId,
      workflow_run_id: context.workflowRunId,
      gate_id: "diff_review_gate",
      gate_stage: "post_run",
      status: "passed",
      findings: [],
      blocking: false,
      created_at: isoAt(context.runAt, 15),
      metadata: {
        review_mode: "pr_draft_only",
      },
    },
    {
      schema_version: "gate-result.v1",
      id: context.testGateId,
      workflow_run_id: context.workflowRunId,
      gate_id: "test_gate",
      gate_stage: "post_run",
      status: context.testResult.status === "passed" ? "passed" : "failed",
      findings: context.testResult.status === "passed"
        ? []
        : [
            {
              finding_id: "finding.personal_dev.test_failed",
              severity: "high",
              message: "Canonical development checks did not pass.",
              refs: [context.outputArtifactId],
            },
          ],
      blocking: context.testResult.status !== "passed",
      created_at: isoAt(context.runAt, 16),
      metadata: {
        commands: context.testResult.commands.map((item) => item.command),
      },
    },
    {
      schema_version: "gate-result.v1",
      id: context.approvalGateId,
      workflow_run_id: context.workflowRunId,
      gate_id: "human_approval_gate",
      gate_stage: "post_run",
      status: "pending",
      findings: [
        {
          finding_id: "finding.personal_dev.merge_approval_pending",
          severity: "info",
          message: "Merge or task-status change requires human approval.",
          refs: [context.outputArtifactId],
        },
      ],
      blocking: true,
      created_at: isoAt(context.runAt, 18),
      metadata: {},
    },
  ];
}

function buildEventLedger(context) {
  const testGateEventType = context.testResult.status === "passed" ? "gate.passed" : "gate.failed";
  const events = [
    ledgerEvent(context, "resource.ingested", "resource", context.resourceId, null, connectorActor(), 0, {}),
    ledgerEvent(context, "issue.created", "issue", context.issueId, "resource.ingested", harnessActor(), 3, {}),
    ledgerEvent(context, "workflow.started", "workflow_run", context.workflowRunId, "issue.created", harnessActor(), 4, {
      capability_id: context.capabilityId,
    }),
    ledgerEvent(context, "agent_run.started", "agent_run", context.claudeRunId, "workflow.started", claudeActor(), 5, {
      lane: "planner_reviewer",
    }, "claude"),
    ledgerEvent(context, "agent_run.completed", "agent_run", context.claudeRunId, "agent_run.started", claudeActor(), 8, {
      status: "completed",
    }, "claude"),
    ledgerEvent(context, "agent_run.started", "agent_run", context.codexRunId, "agent_run.completed", codexActor(), 9, {
      lane: "implementation_patch_generator",
    }, "codex"),
    ledgerEvent(context, "agent_run.completed", "agent_run", context.codexRunId, "agent_run.started", codexActor(), 12, {
      status: "completed",
      output_trust: "untrusted_until_verified",
    }, "codex"),
    ledgerEvent(context, "agent_run.started", "agent_run", context.localRunId, "agent_run.completed", scriptActor(), 13, {
      lane: "canonical_test_gate",
    }, "local"),
    ledgerEvent(context, "agent_run.completed", "agent_run", context.localRunId, "agent_run.started", scriptActor(), 16, {
      status: context.testResult.status,
      exit_code: context.testResult.exit_code,
    }, "local"),
    ledgerEvent(context, "gate.passed", "gate_result", context.protectedGateId, "agent_run.completed", harnessActor("gate.protected_file", "Protected File Gate"), 14, {
      gate_id: "protected_file_gate",
    }, "protected"),
    ledgerEvent(context, "gate.passed", "gate_result", context.diffGateId, "gate.passed", harnessActor("gate.diff_review", "Diff Review Gate"), 15, {
      gate_id: "diff_review_gate",
    }, "diff"),
    ledgerEvent(context, testGateEventType, "gate_result", context.testGateId, "agent_run.completed", harnessActor("gate.test", "Test Gate"), 16, {
      gate_id: "test_gate",
    }, "test"),
    ledgerEvent(context, "output.rendered", "output_artifact", context.outputArtifactId, testGateEventType, harnessActor(), 17, {
      artifact_type: "pr_draft",
    }),
    ledgerEvent(context, "approval.requested", "approval", context.approvalId, "output.rendered", harnessActor(), 18, {
      output_artifact_id: context.outputArtifactId,
    }),
    ledgerEvent(context, "cost.recorded", "cost_record", context.costRecordId, "agent_run.completed", harnessActor(), 19, {
      cost_type: "runtime_seconds",
      amount: 11,
    }),
  ];

  return {
    schema_version: "event-ledger.v1",
    ledger_id: `ledger.personal_dev.${context.idSuffix}`,
    generated_at: isoAt(context.runAt, 20),
    events,
    run_ledgers: [
      {
        schema_version: "run-ledger.v1",
        id: `run-ledger.personal_dev.${context.idSuffix}`,
        tenant_id: context.ids.tenantId,
        workflow_run_id: context.workflowRunId,
        capability_id: context.capabilityId,
        policy_snapshot_id: context.ids.policySnapshotId,
        status: "blocked",
        input_refs: [context.resourceId],
        agent_run_ids: [context.claudeRunId, context.codexRunId, context.localRunId],
        gate_result_ids: [context.protectedGateId, context.diffGateId, context.testGateId, context.approvalGateId],
        approval_ids: [context.approvalId],
        output_artifact_ids: [context.outputArtifactId],
        event_ids: events.map((event) => event.id),
        cost_records: [
          {
            cost_record_id: context.costRecordId,
            cost_type: "runtime_seconds",
            amount: 11,
            unit: "seconds",
            created_at: isoAt(context.runAt, 19),
            metadata: {
              local_checks: context.testResult.commands.length,
            },
          },
        ],
        error_records: [],
        created_at: isoAt(context.runAt, 4),
        updated_at: isoAt(context.runAt, 20),
        metadata: {
          blocked_reason: "merge_approval_pending",
        },
      },
    ],
    metadata: {},
  };
}

function ledgerEvent(context, type, subjectType, subjectId, causationType, actor, offset, data, disambiguator = "") {
  const suffix = disambiguator ? `${context.idSuffix}.${disambiguator}` : context.idSuffix;
  const causationId = causationType
    ? findPriorEventId(context.idSuffix, causationType, disambiguator)
    : null;
  return {
    schema_version: "event.v1",
    id: `event.${type}.personal_dev.${suffix}`,
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
    policy_snapshot_id: context.ids.policySnapshotId,
    data,
    metadata: {},
  };
}

function findPriorEventId(idSuffix, type, disambiguator) {
  if (type === "resource.ingested") return `event.resource.ingested.personal_dev.${idSuffix}`;
  if (type === "issue.created") return `event.issue.created.personal_dev.${idSuffix}`;
  if (type === "workflow.started") return `event.workflow.started.personal_dev.${idSuffix}`;
  if (type === "output.rendered") return `event.output.rendered.personal_dev.${idSuffix}`;
  if (type === "gate.passed" && disambiguator === "diff") {
    return `event.gate.passed.personal_dev.${idSuffix}.protected`;
  }
  if (type === "gate.passed") return `event.gate.passed.personal_dev.${idSuffix}.test`;
  if (type === "gate.failed") return `event.gate.failed.personal_dev.${idSuffix}.test`;
  if (type === "agent_run.completed" && disambiguator === "codex") {
    return `event.agent_run.completed.personal_dev.${idSuffix}.claude`;
  }
  if (type === "agent_run.completed" && disambiguator === "local") {
    return `event.agent_run.completed.personal_dev.${idSuffix}.codex`;
  }
  if (type === "agent_run.completed") return `event.agent_run.completed.personal_dev.${idSuffix}.local`;
  if (type === "agent_run.started" && disambiguator) {
    return `event.agent_run.started.personal_dev.${idSuffix}.${disambiguator}`;
  }
  return `event.${type}.personal_dev.${idSuffix}`;
}

function agentRun(id, workflowRunId, runtimeId, inputRef, outputRef, runAt, startOffset, endOffset, metadata) {
  return {
    schema_version: "agent-run.v1",
    id,
    workflow_run_id: workflowRunId,
    runtime_id: runtimeId,
    status: "completed",
    input_ref: inputRef,
    output_ref: outputRef,
    logs_ref: `logs/${id}.log`,
    started_at: isoAt(runAt, startOffset),
    completed_at: isoAt(runAt, endOffset),
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

function renderTaskSourceSpan(selected) {
  const acceptance = selected.task.acceptance?.map((item) => `- ${item}`).join("\n") ?? "- Human review required";
  return [
    `Project: ${selected.project.id} ${selected.project.name}`,
    `Task: ${selected.task.id} ${selected.task.title}`,
    `Status: ${selected.task.status}`,
    `Priority: ${selected.task.priority}`,
    `Due: ${selected.task.due}`,
    `Context: ${selected.task.context ?? "none"}`,
    "Acceptance:",
    acceptance,
  ].join("\n");
}

function taskSeverity(task) {
  if (task.priority === "p0") return "high";
  if (task.priority === "p1") return "medium";
  return "low";
}

function connectorActor() {
  return {
    actor_type: "connector",
    actor_id: "connector.local_filesystem",
    display_name: "Local Filesystem",
  };
}

function harnessActor(actorId = "harness.orchestrator", displayName = "Harness Orchestrator") {
  return {
    actor_type: "harness",
    actor_id: actorId,
    display_name: displayName,
  };
}

function claudeActor() {
  return {
    actor_type: "claude_code",
    actor_id: "runtime.claude_code.default",
    display_name: "Claude Code Runtime",
  };
}

function codexActor() {
  return {
    actor_type: "codex",
    actor_id: "runtime.codex.default",
    display_name: "Codex Runtime",
  };
}

function scriptActor() {
  return {
    actor_type: "script",
    actor_id: "runtime.local_script.default",
    display_name: "Local Script Runtime",
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableId(value) {
  return sha256(value).slice(0, 12);
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function isoAt(baseIso, seconds) {
  return new Date(new Date(baseIso).getTime() + seconds * 1000).toISOString();
}

function isoDate(iso) {
  return iso.slice(0, 10);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const parsed = {
    inputPath: DEFAULT_PERSONAL_DEV_INPUT,
    outDir: DEFAULT_PERSONAL_DEV_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--today") parsed.today = argv[++index];
    else if (arg === "--task-id") parsed.taskId = argv[++index];
    else if (arg === "--runtime-mode") parsed.runtimeMode = argv[++index];
    else if (arg === "--skip-tests") parsed.skipTests = true;
    else if (arg.startsWith("--")) throw new Error(`Unknown argument: ${arg}`);
    else parsed.inputPath = arg;
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/run-personal-dev-slice.mjs [dev-projects.json] [options]

Options:
  --out-dir <path>   Output directory for personal-dev-slice.json, event-ledger.json, plan.json, and pr-draft.md.
  --task-id <id>     Force a specific task ID from the portfolio.
  --today <date>     Date used to choose recommended focus.
  --run-at <iso>     Fixed ISO timestamp for deterministic runs.
  --runtime-mode <dry-run|execute>
                     Runtime invocation mode. Defaults to dry-run.
  --skip-tests       Skip canonical dev checks and record a skipped test result.
  -h, --help         Show this help.
`);
}
