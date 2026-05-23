import { spawn } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONTROL_PLANE_LOOP_OUT_DIR = "artifacts/control-plane-loop/latest";

export const DEFAULT_CONTROL_PLANE_LOOP_STEPS = [
  step("policy_matrix_catalog", "Policy Matrix Catalog", "policy", ["npm", "run", "policy:catalog"], ["artifacts/policy-matrix/latest/policy-matrix-catalog.json"]),
  step("policy_snapshot_ledger", "Policy Snapshot Ledger", "policy", ["npm", "run", "policy:snapshots"], ["artifacts/policy-snapshots/latest/policy-snapshot-ledger.json"]),
  step("control_plane_pipeline", "Control Plane Pipeline", "pipeline", ["npm", "run", "control-plane:pipeline"], ["artifacts/control-plane-pipeline/latest/control-plane-pipeline.json"]),
  step("context_packet_ledger", "Context Packet Ledger", "context", ["npm", "run", "context:packets"], ["artifacts/context-packets/latest/context-packet-ledger.json"]),
  step("model_routing_ledger", "Model Routing Ledger", "runtime", ["npm", "run", "model:routing"], ["artifacts/model-routing/latest/model-routing-ledger.json"]),
  step("cost_budget_ledger", "Cost Budget Ledger", "gate", ["npm", "run", "cost:budgets"], ["artifacts/cost-budget/latest/cost-budget-ledger.json"]),
  step("token_usage_ledger", "Token Usage Ledger", "observability", ["npm", "run", "token:usage"], ["artifacts/token-usage/latest/token-usage-ledger.json"]),
  step("cost_attribution_ledger", "Cost Attribution Ledger", "observability", ["npm", "run", "cost:attribution"], ["artifacts/cost-attribution/latest/cost-attribution-ledger.json"]),
  step("budget_alert_ledger", "Budget Alert Ledger", "observability", ["npm", "run", "budget:alerts"], ["artifacts/budget-alerts/latest/budget-alert-ledger.json"]),
  step("dashboard_pre_health", "Dashboard Pre-Health", "dashboard", ["npm", "run", "dashboard:build"], ["artifacts/dashboard/latest/review-dashboard.json"]),
  step("control_plane_health", "Control Plane Health", "health", ["npm", "run", "control-plane:health"], ["artifacts/control-plane-health/latest/control-plane-health.json"]),
  step("control_plane_action_plan", "Control Plane Action Plan", "planning", ["npm", "run", "control-plane:plan"], ["artifacts/control-plane-action-plan/latest/control-plane-action-plan.json"]),
  step("control_plane_human_gates", "Control Plane Human Gates", "planning", ["npm", "run", "control-plane:human-gates"], ["artifacts/control-plane-human-gates/latest/control-plane-human-gates.json"]),
  step("control_plane_human_gate_receipts", "Control Plane Human Gate Receipts", "receipt", ["npm", "run", "control-plane:human-gate-receipts"], ["artifacts/control-plane-human-gate-receipts/latest/control-plane-human-gate-receipt-drafts.json"]),
  step("human_review_packet_ledger", "Human Review Packet Ledger", "planning", ["npm", "run", "control-plane:review-packets"], ["artifacts/human-review-packets/latest/human-review-packet-ledger.json"]),
  step("control_plane_human_gate_receipt_validation", "Control Plane Human Gate Receipt Validation", "receipt", ["npm", "run", "control-plane:human-gate-receipts:validate"], ["artifacts/control-plane-human-gate-receipt-validation/latest/control-plane-human-gate-receipt-validation.json"]),
  step("control_plane_human_gate_receipt_application", "Control Plane Human Gate Receipt Application", "receipt", ["npm", "run", "control-plane:human-gate-receipts:apply"], ["artifacts/control-plane-human-gate-receipt-application/latest/control-plane-human-gate-receipt-application.json"]),
  step("control_plane_work_packets", "Control Plane Work Packets", "planning", ["npm", "run", "control-plane:work-packets"], ["artifacts/control-plane-work-packets/latest/control-plane-work-packets.json"]),
  step("control_plane_work_packet_receipts", "Control Plane Work Packet Receipts", "receipt", ["npm", "run", "control-plane:work-receipts"], ["artifacts/control-plane-work-packet-receipts/latest/control-plane-work-packet-receipt-drafts.json"]),
  step("control_plane_work_packet_receipt_validation", "Control Plane Work Packet Receipt Validation", "receipt", ["npm", "run", "control-plane:work-receipts:validate"], ["artifacts/control-plane-work-packet-receipt-validation/latest/control-plane-work-packet-receipt-validation.json"]),
  step("control_plane_work_packet_receipt_application", "Control Plane Work Packet Receipt Application", "receipt", ["npm", "run", "control-plane:work-receipts:apply"], ["artifacts/control-plane-work-packet-receipt-application/latest/control-plane-work-packet-receipt-application.json"]),
  step("control_plane_audit_trail", "Control Plane Audit Trail", "audit", ["npm", "run", "control-plane:audit-trail"], ["artifacts/control-plane-audit-trail/latest/control-plane-audit-trail.json"]),
  step("evidence_review_draft", "Evidence Review Draft", "evidence_review", ["npm", "run", "evidence:review:draft"], ["artifacts/evidence-review-draft/latest/evidence-review-draft.json"]),
  step("dashboard_before_checkpoint", "Dashboard Before Goal Checkpoint", "dashboard", ["node", "scripts/review-dashboard.mjs", "--no-control-plane-goal-checkpoint"], ["artifacts/dashboard/latest/review-dashboard.json"]),
  step("control_plane_goal_checkpoint", "Control Plane Goal Checkpoint", "checkpoint", ["npm", "run", "control-plane:goal-checkpoint"], ["artifacts/control-plane-goal-checkpoint/latest/control-plane-goal-checkpoint.json"]),
  step("dashboard_final", "Dashboard Final", "dashboard", ["npm", "run", "dashboard:build"], ["artifacts/dashboard/latest/review-dashboard.json"]),
  step("api_smoke", "Review API Smoke", "api", ["npm", "run", "api:smoke"], []),
];

export const DEFAULT_CONTROL_PLANE_LOOP_FINALIZATION_STEPS = [
  step("goal_checkpoint_after_loop", "Goal Checkpoint After Loop", "finalization", ["npm", "run", "control-plane:goal-checkpoint"], ["artifacts/control-plane-goal-checkpoint/latest/control-plane-goal-checkpoint.json"]),
  step("dashboard_after_loop", "Dashboard After Loop", "finalization", ["npm", "run", "dashboard:build"], ["artifacts/dashboard/latest/review-dashboard.json"]),
  step("api_smoke_after_loop", "API Smoke After Loop", "finalization", ["npm", "run", "api:smoke"], []),
];

export async function runControlPlaneLoop(options = {}) {
  const result = await buildControlPlaneLoop(options);
  if (options.write !== false) await writeControlPlaneLoop(result, result.output_dir);
  return result;
}

export async function runControlPlaneLoopFinalization(options = {}) {
  const result = await buildControlPlaneLoopFinalization(options);
  if (options.write !== false) await writeControlPlaneLoopFinalization(result, result.output_dir);
  return result;
}

export async function buildControlPlaneLoop(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONTROL_PLANE_LOOP_OUT_DIR);
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const continueOnError = options.continueOnError ?? true;
  const writeProgress = options.writeProgress ?? options.write !== false;
  const steps = normalizeSteps(options.steps ?? DEFAULT_CONTROL_PLANE_LOOP_STEPS);
  const stepResults = [];
  let previousFailure = false;

  for (const loopStep of steps) {
    if (previousFailure && !continueOnError) {
      stepResults.push(buildSkippedStepResult(loopStep, cwd, "skipped_after_failure"));
    } else {
      const result = await runLoopStep(loopStep, { cwd });
      stepResults.push(result);
      if (result.status !== "passed") previousFailure = true;
    }

    if (writeProgress) {
      await writeControlPlaneLoop(buildLoopArtifact({ generatedAt, outputDir, cwd, continueOnError, stepResults }));
    }
  }

  return buildLoopArtifact({ generatedAt, outputDir, cwd, continueOnError, stepResults });
}

export async function writeControlPlaneLoop(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "control-plane-loop.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    loop_id: result.loop_id,
    output_dir: result.output_dir,
    cwd: result.cwd,
    continue_on_error: result.continue_on_error,
    loop_status: result.loop_status,
    summary: result.summary,
    step_results: result.step_results,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function buildControlPlaneLoopFinalization(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONTROL_PLANE_LOOP_OUT_DIR);
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const steps = normalizeSteps(options.steps ?? DEFAULT_CONTROL_PLANE_LOOP_FINALIZATION_STEPS);
  const stepResults = [];

  for (const finalizationStep of steps) {
    stepResults.push(await runLoopStep(finalizationStep, { cwd }));
  }

  return buildFinalizationArtifact({ generatedAt, outputDir, cwd, stepResults });
}

export async function writeControlPlaneLoopFinalization(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "control-plane-loop-finalization.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    finalization_id: result.finalization_id,
    output_dir: result.output_dir,
    cwd: result.cwd,
    finalization_status: result.finalization_status,
    summary: result.summary,
    step_results: result.step_results,
  });
  await writeFile(path.join(outDir, "finalization-summary.md"), result.markdown, "utf8");
}

export async function runControlPlaneLoopCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runControlPlaneLoop(args);
  const finalization = args.finalize
    ? await runControlPlaneLoopFinalization({
      outDir: args.outDir,
      cwd: args.cwd,
      runAt: args.runAt,
    })
    : null;
  console.log(`Control plane loop written to ${result.output_dir}`);
  console.log(`Loop status: ${result.loop_status}`);
  console.log(`Passed steps: ${result.summary.passed_step_count}/${result.summary.step_count}`);
  console.log(`Failed steps: ${result.summary.failed_step_count}`);
  if (finalization) {
    console.log(`Finalization status: ${finalization.finalization_status}`);
    console.log(`Finalization steps: ${finalization.summary.passed_step_count}/${finalization.summary.step_count}`);
  }
  if (
    result.summary.failed_step_count > 0
    || result.summary.missing_artifact_count > 0
    || (finalization && (finalization.summary.failed_step_count > 0 || finalization.summary.missing_artifact_count > 0))
  ) {
    process.exitCode = 1;
  }
}

function buildLoopArtifact({ generatedAt, outputDir, cwd, continueOnError, stepResults }) {
  const summary = summarizeLoop(stepResults);
  const loop = {
    schema_version: "control-plane-loop.v1",
    generated_at: generatedAt,
    loop_id: `control-plane-loop.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    cwd,
    continue_on_error: continueOnError,
    loop_status: summary.overall_status,
    summary,
    step_results: stepResults,
  };

  return {
    ...loop,
    markdown: renderLoopMarkdown(loop),
  };
}

function buildFinalizationArtifact({ generatedAt, outputDir, cwd, stepResults }) {
  const summary = summarizeLoop(stepResults);
  const finalization = {
    schema_version: "control-plane-loop-finalization.v1",
    generated_at: generatedAt,
    finalization_id: `control-plane-loop-finalization.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    cwd,
    finalization_status: summary.overall_status,
    summary,
    step_results: stepResults,
  };

  return {
    ...finalization,
    markdown: renderFinalizationMarkdown(finalization),
  };
}

async function runLoopStep(loopStep, context) {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const execution = await runCommand(loopStep.command, {
    cwd: context.cwd,
    timeoutMs: loopStep.timeout_ms,
  });
  const completedAtMs = Date.now();
  const artifactChecks = await checkArtifacts(loopStep.expected_artifacts, context.cwd);
  const missingArtifacts = artifactChecks.filter((artifact) => !artifact.exists);
  const commandPassed = execution.exit_code === 0 && !execution.signal;
  const status = commandPassed && missingArtifacts.length === 0 ? "passed" : commandPassed ? "artifact_missing" : "failed";

  return {
    step_id: loopStep.step_id,
    label: loopStep.label,
    category: loopStep.category,
    status,
    command: loopStep.command,
    cwd: context.cwd,
    protected_action: loopStep.protected_action,
    started_at: startedAt,
    completed_at: new Date(completedAtMs).toISOString(),
    duration_ms: completedAtMs - startedAtMs,
    exit_code: execution.exit_code,
    signal: execution.signal,
    stdout: execution.stdout,
    stderr: execution.stderr,
    expected_artifacts: artifactChecks,
    error: status === "passed"
      ? null
      : commandPassed
        ? `Missing expected artifact(s): ${missingArtifacts.map((artifact) => artifact.path).join(", ")}`
        : `Command exited with ${execution.exit_code ?? execution.signal}`,
  };
}

function buildSkippedStepResult(loopStep, cwd, reason) {
  const now = new Date().toISOString();
  return {
    step_id: loopStep.step_id,
    label: loopStep.label,
    category: loopStep.category,
    status: "skipped",
    command: loopStep.command,
    cwd,
    protected_action: loopStep.protected_action,
    started_at: now,
    completed_at: now,
    duration_ms: 0,
    exit_code: null,
    signal: null,
    stdout: "",
    stderr: "",
    expected_artifacts: loopStep.expected_artifacts.map((artifactPath) => ({
      path: path.resolve(cwd, artifactPath),
      exists: false,
    })),
    error: reason,
  };
}

function summarizeLoop(stepResults) {
  const failedStepCount = stepResults.filter((result) => result.status === "failed").length;
  const missingArtifactCount = stepResults.reduce(
    (count, result) => count + result.expected_artifacts.filter((artifact) => !artifact.exists).length,
    0,
  );
  const skippedStepCount = stepResults.filter((result) => result.status === "skipped").length;
  const artifactMissingStepCount = stepResults.filter((result) => result.status === "artifact_missing").length;
  const overallStatus = failedStepCount > 0
    ? "failed"
    : artifactMissingStepCount > 0 || missingArtifactCount > 0
      ? "artifact_missing"
      : skippedStepCount > 0
        ? "partial"
        : "passed";
  return {
    overall_status: overallStatus,
    step_count: stepResults.length,
    passed_step_count: stepResults.filter((result) => result.status === "passed").length,
    failed_step_count: failedStepCount,
    skipped_step_count: skippedStepCount,
    artifact_missing_step_count: artifactMissingStepCount,
    missing_artifact_count: missingArtifactCount,
    protected_action_count: stepResults.filter((result) => result.protected_action).length,
    total_duration_ms: stepResults.reduce((sum, result) => sum + result.duration_ms, 0),
    by_status: countBy(stepResults, "status"),
    by_category: countBy(stepResults, "category"),
  };
}

function renderLoopMarkdown(loop) {
  const lines = [];
  lines.push("# Control Plane Loop");
  lines.push("");
  lines.push(`Generated: ${loop.generated_at}`);
  lines.push(`Loop status: ${loop.loop_status}`);
  lines.push("");
  lines.push(`- Steps: ${loop.summary.step_count}`);
  lines.push(`- Passed: ${loop.summary.passed_step_count}`);
  lines.push(`- Failed: ${loop.summary.failed_step_count}`);
  lines.push(`- Missing artifacts: ${loop.summary.missing_artifact_count}`);
  lines.push(`- Duration ms: ${loop.summary.total_duration_ms}`);
  lines.push("");
  lines.push("## Steps");
  lines.push("");
  for (const result of loop.step_results) {
    lines.push(`- ${result.step_id}: ${result.status} (${result.duration_ms}ms)`);
  }
  return `${lines.join("\n")}\n`;
}

function renderFinalizationMarkdown(finalization) {
  const lines = [];
  lines.push("# Control Plane Loop Finalization");
  lines.push("");
  lines.push(`Generated: ${finalization.generated_at}`);
  lines.push(`Finalization status: ${finalization.finalization_status}`);
  lines.push("");
  lines.push(`- Steps: ${finalization.summary.step_count}`);
  lines.push(`- Passed: ${finalization.summary.passed_step_count}`);
  lines.push(`- Failed: ${finalization.summary.failed_step_count}`);
  lines.push(`- Missing artifacts: ${finalization.summary.missing_artifact_count}`);
  lines.push(`- Duration ms: ${finalization.summary.total_duration_ms}`);
  lines.push("");
  lines.push("## Steps");
  lines.push("");
  for (const result of finalization.step_results) {
    lines.push(`- ${result.step_id}: ${result.status} (${result.duration_ms}ms)`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeSteps(steps) {
  return steps.map((candidate) => ({
    step_id: candidate.step_id,
    label: candidate.label ?? candidate.step_id,
    category: candidate.category ?? "control_plane_loop",
    command: Array.isArray(candidate.command) ? candidate.command.map(String) : splitCommand(candidate.command),
    expected_artifacts: (candidate.expected_artifacts ?? []).map(String),
    timeout_ms: Number(candidate.timeout_ms ?? 120000),
    protected_action: Boolean(candidate.protected_action ?? false),
  }));
}

function step(stepId, label, category, command, expectedArtifacts = []) {
  return {
    step_id: stepId,
    label,
    category,
    command,
    expected_artifacts: expectedArtifacts,
    timeout_ms: 120000,
    protected_action: false,
  };
}

function runCommand(command, options) {
  const [bin, ...args] = command;
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(bin, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => child.kill("SIGTERM"), options.timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        exit_code: 1,
        signal: null,
        stdout: trimOutput(stdout),
        stderr: trimOutput(`${stderr}${stderr ? "\n" : ""}${error.message}`),
      });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        exit_code: code,
        signal,
        stdout: trimOutput(stdout),
        stderr: trimOutput(stderr),
      });
    });
  });
}

async function checkArtifacts(expectedArtifacts, cwd) {
  const checks = [];
  for (const artifactPath of expectedArtifacts) {
    const resolvedPath = path.resolve(cwd, artifactPath);
    checks.push({
      path: resolvedPath,
      exists: await exists(resolvedPath),
    });
  }
  return checks;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function splitCommand(command) {
  if (!command) throw new Error("Loop step command is required.");
  return String(command).split(/\s+/).filter(Boolean);
}

function trimOutput(value, maxLength = 6000) {
  const text = String(value ?? "").trimEnd();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n... truncated ...`;
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

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_CONTROL_PLANE_LOOP_OUT_DIR,
    continueOnError: true,
    finalize: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--cwd") parsed.cwd = argv[++index];
    else if (arg === "--fail-fast") parsed.continueOnError = false;
    else if (arg === "--continue-on-error") parsed.continueOnError = true;
    else if (arg === "--finalize") parsed.finalize = true;
    else if (arg === "--no-finalize") parsed.finalize = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/control-plane-loop.mjs [options]

Options:
  --out-dir <folder>       Output directory.
  --cwd <folder>           Repository root to run commands in.
  --run-at <iso>           Deterministic generated_at timestamp.
  --continue-on-error      Continue running later steps after a failed step.
  --fail-fast              Skip later steps after the first failure.
  --finalize               Refresh checkpoint, dashboard, and API smoke after the loop.
  --no-finalize            Skip post-loop artifact refresh.
  -h, --help               Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
