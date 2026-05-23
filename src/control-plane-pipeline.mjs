import { spawn } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONTROL_PLANE_PIPELINE_OUT_DIR = "artifacts/control-plane-pipeline/latest";

export const DEFAULT_CONTROL_PLANE_PIPELINE_STEPS = [
  step("domain_pack_registry", "Domain Pack Registry", "pack_registry", ["npm", "run", "packs:registry"], ["artifacts/domain-packs/latest/domain-pack-registry.json"]),
  step("output_artifact_catalog", "Output Artifact Catalog", "output_plane", ["npm", "run", "output:catalog"], ["artifacts/output-catalog/latest/output-catalog.json"]),
  step("observability_catalog", "Observability Catalog", "observability_plane", ["npm", "run", "observability:catalog"], ["artifacts/observability/latest/observability-catalog.json"]),
  step("protected_delivery_queue", "Protected Delivery Queue", "delivery_plane", ["npm", "run", "delivery:queue"], ["artifacts/delivery-queue/latest/protected-delivery-queue.json"]),
  step("matter_cockpit", "Matter Cockpit", "matter_plane", ["npm", "run", "matter:cockpit"], ["artifacts/matter-cockpit/latest/matter-cockpit.json"]),
  step("approval_inbox", "Approval Inbox", "approval_plane", ["npm", "run", "approval:inbox"], ["artifacts/approval-inbox/latest/approval-inbox.json"]),
  step("approval_inbox_decisions", "Approval Inbox Decisions", "approval_plane", ["npm", "run", "approval:inbox:apply"], ["artifacts/approval-inbox-decisions/latest/approval-inbox-decision-result.json"]),
  step("delivery_execution_draft", "Delivery Execution Draft", "delivery_plane", ["npm", "run", "delivery:execution:draft"], ["artifacts/delivery-execution/latest/delivery-execution-draft.json"]),
  step("post_delivery_reconciliation", "Post-Delivery Reconciliation", "delivery_plane", ["npm", "run", "delivery:reconcile"], ["artifacts/post-delivery-reconciliation/latest/post-delivery-reconciliation.json"]),
  step("delivery_closeout_queue", "Delivery Closeout Queue", "delivery_plane", ["npm", "run", "delivery:closeout"], ["artifacts/delivery-closeout/latest/delivery-closeout-queue.json"]),
  step("closeout_receipt_validation", "Closeout Receipt Validation", "delivery_plane", ["npm", "run", "delivery:closeout:validate"], ["artifacts/delivery-closeout-validation/latest/closeout-receipt-validation.json"]),
  step("closeout_receipt_application", "Closeout Receipt Application", "delivery_plane", ["npm", "run", "delivery:closeout:apply"], ["artifacts/delivery-closeout-application/latest/closeout-receipt-application.json"]),
  step("control_plane_audit_trail", "Control Plane Audit Trail", "audit_plane", ["npm", "run", "control-plane:audit-trail"], ["artifacts/control-plane-audit-trail/latest/control-plane-audit-trail.json"]),
];

export async function runControlPlanePipeline(options = {}) {
  const result = await buildControlPlanePipeline(options);
  if (options.write !== false) await writeControlPlanePipeline(result, result.output_dir);
  return result;
}

export async function buildControlPlanePipeline(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONTROL_PLANE_PIPELINE_OUT_DIR);
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const continueOnError = options.continueOnError ?? true;
  const steps = normalizeSteps(options.steps ?? DEFAULT_CONTROL_PLANE_PIPELINE_STEPS);
  const stepResults = [];
  let previousFailure = false;

  for (const pipelineStep of steps) {
    if (previousFailure && !continueOnError) {
      stepResults.push(buildSkippedStepResult(pipelineStep, cwd, "skipped_after_failure"));
      continue;
    }

    const result = await runPipelineStep(pipelineStep, { cwd, generatedAt });
    stepResults.push(result);
    if (result.status !== "passed") previousFailure = true;
  }

  const pipeline = {
    schema_version: "control-plane-pipeline.v1",
    generated_at: generatedAt,
    pipeline_id: `control-plane-pipeline.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    cwd,
    continue_on_error: continueOnError,
    summary: summarizePipeline(stepResults),
    step_results: stepResults,
  };

  return {
    ...pipeline,
    markdown: renderPipelineMarkdown(pipeline),
  };
}

export async function writeControlPlanePipeline(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "control-plane-pipeline.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    pipeline_id: result.pipeline_id,
    output_dir: result.output_dir,
    cwd: result.cwd,
    continue_on_error: result.continue_on_error,
    summary: result.summary,
    step_results: result.step_results,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runControlPlanePipelineCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runControlPlanePipeline(args);
  console.log(`Control plane pipeline written to ${result.output_dir}`);
  console.log(`Overall status: ${result.summary.overall_status}`);
  console.log(`Passed steps: ${result.summary.passed_step_count}`);
  console.log(`Failed steps: ${result.summary.failed_step_count}`);
  if (result.summary.failed_step_count > 0 || result.summary.missing_artifact_count > 0) process.exitCode = 1;
}

async function runPipelineStep(pipelineStep, context) {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const execution = await runCommand(pipelineStep.command, {
    cwd: context.cwd,
    timeoutMs: pipelineStep.timeout_ms,
  });
  const completedAtMs = Date.now();
  const artifactChecks = await checkArtifacts(pipelineStep.expected_artifacts, context.cwd);
  const missingArtifacts = artifactChecks.filter((artifact) => !artifact.exists);
  const commandPassed = execution.exit_code === 0 && !execution.signal;
  const status = commandPassed && missingArtifacts.length === 0 ? "passed" : commandPassed ? "artifact_missing" : "failed";

  return {
    step_id: pipelineStep.step_id,
    label: pipelineStep.label,
    category: pipelineStep.category,
    status,
    command: pipelineStep.command,
    cwd: context.cwd,
    protected_action: pipelineStep.protected_action,
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

function buildSkippedStepResult(pipelineStep, cwd, reason) {
  const now = new Date().toISOString();
  return {
    step_id: pipelineStep.step_id,
    label: pipelineStep.label,
    category: pipelineStep.category,
    status: "skipped",
    command: pipelineStep.command,
    cwd,
    protected_action: pipelineStep.protected_action,
    started_at: now,
    completed_at: now,
    duration_ms: 0,
    exit_code: null,
    signal: null,
    stdout: "",
    stderr: "",
    expected_artifacts: pipelineStep.expected_artifacts.map((artifactPath) => ({
      path: path.resolve(cwd, artifactPath),
      exists: false,
    })),
    error: reason,
  };
}

function summarizePipeline(stepResults) {
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

function renderPipelineMarkdown(pipeline) {
  const lines = [];
  lines.push("# Control Plane Pipeline");
  lines.push("");
  lines.push(`Generated: ${pipeline.generated_at}`);
  lines.push(`Overall status: ${pipeline.summary.overall_status}`);
  lines.push("");
  lines.push(`- Steps: ${pipeline.summary.step_count}`);
  lines.push(`- Passed: ${pipeline.summary.passed_step_count}`);
  lines.push(`- Failed: ${pipeline.summary.failed_step_count}`);
  lines.push(`- Missing artifacts: ${pipeline.summary.missing_artifact_count}`);
  lines.push(`- Duration ms: ${pipeline.summary.total_duration_ms}`);
  lines.push("");
  lines.push("## Steps");
  lines.push("");
  for (const result of pipeline.step_results) {
    lines.push(`- ${result.step_id}: ${result.status} (${result.duration_ms}ms)`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeSteps(steps) {
  return steps.map((candidate) => ({
    step_id: candidate.step_id,
    label: candidate.label ?? candidate.step_id,
    category: candidate.category ?? "control_plane",
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
  if (!command) throw new Error("Pipeline step command is required.");
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
    outDir: DEFAULT_CONTROL_PLANE_PIPELINE_OUT_DIR,
    continueOnError: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--cwd") parsed.cwd = argv[++index];
    else if (arg === "--fail-fast") parsed.continueOnError = false;
    else if (arg === "--continue-on-error") parsed.continueOnError = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/control-plane-pipeline.mjs [options]

Options:
  --out-dir <folder>       Output directory.
  --cwd <folder>           Repository root to run commands in.
  --run-at <iso>           Deterministic generated_at timestamp.
  --continue-on-error      Continue running later steps after a failed step.
  --fail-fast              Skip later steps after the first failure.
  -h, --help               Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
