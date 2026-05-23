import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_READINESS_OUT_DIR = "artifacts/human-review-cycle-receipt-completion-readiness/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_READINESS_INPUTS = {
  completionRunbookPath: "artifacts/human-review-cycle-receipt-completion-runbook/latest/human-review-cycle-receipt-completion-runbook.json",
  completionVerificationPath: "artifacts/human-review-cycle-receipt-completion-verification/latest/human-review-cycle-receipt-completion-verification.json",
};

const REFRESH_COMMAND_KEYS = new Set([
  "rerun_completion_verification",
  "rerun_completion_workbench",
  "rerun_completion_runbook",
  "rebuild_dashboard",
  "rerun_api_smoke",
]);

const POST_INPUT_COMMAND_KEYS = new Set([
  "rerun_correction_merge",
  "rerun_correction_validation",
  "rerun_receipt_field_audit",
]);

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export async function runHumanReviewCycleReceiptCompletionReadiness(options = {}) {
  const result = await buildHumanReviewCycleReceiptCompletionReadiness(options);
  if (options.write !== false) await writeHumanReviewCycleReceiptCompletionReadiness(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle receipt completion readiness failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleReceiptCompletionReadiness(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_READINESS_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const completionRunbookPath = path.resolve(options.completionRunbookPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_READINESS_INPUTS.completionRunbookPath);
  const completionVerificationPath = path.resolve(options.completionVerificationPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_READINESS_INPUTS.completionVerificationPath);
  const runbookResult = await readJsonOrError(completionRunbookPath);
  const verificationResult = await readJsonOrError(completionVerificationPath);
  const runbook = runbookResult.value;
  const commandGates = buildCommandGates(runbook?.runbook_steps ?? [], runbook, verificationResult.value);
  const manualRequirements = buildManualRequirements(runbook?.runbook_steps ?? [], runbook);
  const actorReadiness = buildActorReadiness(runbook?.actor_runbooks ?? [], commandGates, outputDir);
  const sources = [
    buildSource("human_review_cycle_receipt_completion_runbook", "Human Review Cycle Receipt Completion Runbook", completionRunbookPath, runbookResult),
    buildSource("human_review_cycle_receipt_completion_verification", "Human Review Cycle Receipt Completion Verification", completionVerificationPath, verificationResult),
  ];
  const validation = validateReadiness({ sources, runbookResult, verificationResult, commandGates, manualRequirements, actorReadiness });
  const readiness = {
    schema_version: "human-review-cycle-receipt-completion-readiness.v1",
    generated_at: generatedAt,
    readiness_id: `human-review-cycle-receipt-completion-readiness.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    readiness_status: deriveReadinessStatus(validation, runbook),
    safe_handling: {
      auto_execute_allowed: false,
      draft_only: true,
      readiness_gate_only: true,
      protected_actions_executed: false,
      receipt_edits_must_be_manual: true,
    },
    sources,
    summary: summarizeReadiness(actorReadiness, commandGates, manualRequirements, sources, runbookResult, verificationResult, validation),
    actor_readiness: actorReadiness,
    command_gates: commandGates,
    manual_requirements: manualRequirements,
    validation,
  };

  return {
    ...readiness,
    markdown: renderReadinessMarkdown(readiness),
    html: renderReadinessHtml(readiness),
  };
}

export async function writeHumanReviewCycleReceiptCompletionReadiness(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-receipt-completion-readiness.json"), serializableReadiness(result));
  await writeJson(path.join(outDir, "command-gates.json"), {
    generated_at: result.generated_at,
    count: result.command_gates.length,
    command_gates: result.command_gates,
  });
  await writeJson(path.join(outDir, "actor-readiness.json"), {
    generated_at: result.generated_at,
    count: result.actor_readiness.length,
    actor_readiness: result.actor_readiness,
  });
  await writeJson(path.join(outDir, "manual-requirements.json"), {
    generated_at: result.generated_at,
    count: result.manual_requirements.length,
    manual_requirements: result.manual_requirements,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runHumanReviewCycleReceiptCompletionReadinessCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleReceiptCompletionReadiness(args);
    console.log(`Human review cycle receipt completion readiness ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Readiness status: ${result.readiness_status}`);
    console.log(`Actor readiness: ${result.summary.actor_readiness_count}`);
    console.log(`Command gates: ${result.summary.command_gate_count}`);
    console.log(`Allowed now: ${result.summary.allowed_command_count}`);
    console.log(`Blocked until manual input: ${result.summary.blocked_until_manual_input_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildCommandGates(steps, runbook, verification) {
  const summary = runbook?.summary ?? {};
  const pendingInput = summary.pending_human_input_count ?? 0;
  const validationErrors = verification?.summary?.validation_error_count ?? verification?.validation?.errors?.length ?? 0;
  const readyForValidation = pendingInput === 0 && (summary.ready_for_validation_count ?? 0) > 0 && validationErrors === 0;
  return steps
    .filter((step) => step.command)
    .map((step) => {
      const commandStatus = deriveCommandStatus(step, { pendingInput, validationErrors, readyForValidation });
      return {
        command_gate_id: `human-review-cycle-receipt-completion-readiness.command.${slugify(step.step_key)}`,
        runbook_step_id: step.runbook_step_id,
        step_key: step.step_key,
        step_type: step.step_type,
        step_rank: step.step_rank,
        command: step.command,
        command_status: commandStatus,
        command_allowed_now: commandStatus === "available_now",
        blocked_reason: buildBlockedReason(step, commandStatus, pendingInput),
        requires_explicit_human_approval: Boolean(step.requires_explicit_human_approval),
        source_refs: {
          runbook_id: runbook?.runbook_id ?? null,
          verification_id: verification?.verification_id ?? null,
        },
        safe_handling: {
          auto_execute_allowed: false,
          readiness_gate_only: true,
          protected_actions_executed: false,
          receipt_edits_must_be_manual: true,
        },
      };
    });
}

function buildManualRequirements(steps, runbook) {
  const summary = runbook?.summary ?? {};
  return steps
    .filter((step) => step.step_type === "manual")
    .map((step) => ({
      manual_requirement_id: `human-review-cycle-receipt-completion-readiness.manual.${slugify(step.step_key)}`,
      runbook_step_id: step.runbook_step_id,
      step_key: step.step_key,
      step_rank: step.step_rank,
      requirement_status: (summary.pending_human_input_count ?? 0) > 0 ? "manual_input_required" : "complete",
      instruction: step.instruction,
      pending_human_input_count: summary.pending_human_input_count ?? 0,
      pending_prompt_count: summary.pending_prompt_count ?? 0,
      target_file_count: summary.target_file_count ?? 0,
      safe_handling: {
        auto_execute_allowed: false,
        readiness_gate_only: true,
        protected_actions_executed: false,
        receipt_edits_must_be_manual: true,
      },
    }));
}

function buildActorReadiness(actorRunbooks, commandGates, outputDir) {
  return (actorRunbooks ?? []).map((actor) => {
    const actorStatus = actor.pending_human_input_count > 0
      ? "waiting_for_human_input"
      : actor.ready_for_validation_count > 0
        ? "ready_for_validation"
        : actor.blocked_count > 0
          ? "blocked"
          : actor.attention_count > 0
            ? "attention"
            : "clear";
    return {
      actor_readiness_id: `human-review-cycle-receipt-completion-readiness.actor.${slugify(actor.required_actor)}`,
      actor_runbook_id: actor.actor_runbook_id,
      required_actor: actor.required_actor,
      readiness_status: actorStatus,
      priority: actor.priority,
      workbench_item_count: actor.workbench_item_count,
      pending_human_input_count: actor.pending_human_input_count,
      ready_for_validation_count: actor.ready_for_validation_count,
      pending_prompt_count: actor.pending_prompt_count,
      target_file_count: actor.target_file_count,
      allowed_command_count: commandGates.filter((gate) => gate.command_allowed_now).length,
      blocked_command_count: commandGates.filter((gate) => !gate.command_allowed_now).length,
      next_allowed_commands: commandGates.filter((gate) => gate.command_allowed_now).map((gate) => gate.command),
      blocked_commands: commandGates.filter((gate) => !gate.command_allowed_now).map((gate) => ({
        step_key: gate.step_key,
        command: gate.command,
        command_status: gate.command_status,
        blocked_reason: gate.blocked_reason,
      })),
      actor_runbook_html_path: actor.completion_runbook_html_path,
      workbench_html_path: actor.workbench_html_path,
      receipt_completion_template_path: actor.receipt_completion_template_path,
      readiness_json_path: path.join(outputDir, "actor-readiness.json"),
      safe_handling: {
        auto_execute_allowed: false,
        draft_only: true,
        readiness_gate_only: true,
        protected_actions_executed: false,
        receipt_edits_must_be_manual: true,
      },
    };
  }).sort(compareActorReadiness);
}

function deriveCommandStatus(step, context) {
  if (step.requires_explicit_human_approval) {
    return context.pendingInput > 0 ? "blocked_until_manual_input" : "requires_explicit_human_approval";
  }
  if (REFRESH_COMMAND_KEYS.has(step.step_key)) return "available_now";
  if (POST_INPUT_COMMAND_KEYS.has(step.step_key)) {
    if (context.validationErrors > 0) return "blocked_by_validation_errors";
    return context.pendingInput > 0 ? "blocked_until_manual_input" : "available_now";
  }
  return context.readyForValidation ? "available_now" : "blocked_until_manual_input";
}

function buildBlockedReason(step, commandStatus, pendingInput) {
  if (commandStatus === "available_now") return null;
  if (commandStatus === "blocked_until_manual_input") return `${pendingInput} receipt item(s) still require manual input.`;
  if (commandStatus === "requires_explicit_human_approval") return "Protected application requires explicit human approval.";
  if (commandStatus === "blocked_by_validation_errors") return "Completion verification has validation errors.";
  return `Command is ${commandStatus}.`;
}

function validateReadiness({ sources, runbookResult, verificationResult, commandGates, manualRequirements, actorReadiness }) {
  const errors = [];
  for (const source of sources) {
    if (!source.available) errors.push({ path: `sources.${source.source_id}`, message: `${source.label} unavailable: ${source.error}` });
  }
  const runbookStepCount = runbookResult.value?.summary?.runbook_step_count ?? 0;
  const actorRunbookCount = runbookResult.value?.summary?.actor_runbook_count ?? 0;
  if (runbookStepCount > 0 && commandGates.length + manualRequirements.length !== runbookStepCount) {
    errors.push({ path: "command_gates", message: "Command gates plus manual requirements must cover every runbook step." });
  }
  if (actorRunbookCount > 0 && actorReadiness.length !== actorRunbookCount) {
    errors.push({ path: "actor_readiness", message: "Actor readiness count must match actor runbook count." });
  }
  if (verificationResult.ok) {
    const verificationItems = verificationResult.value?.summary?.verification_item_count ?? 0;
    const runbookItems = runbookResult.value?.summary?.workbench_item_count ?? 0;
    if (verificationItems > 0 && verificationItems !== runbookItems) {
      errors.push({ path: "sources.human_review_cycle_receipt_completion_verification.summary.verification_item_count", message: "Completion verification and runbook workbench item counts must agree." });
    }
  }
  for (const gate of commandGates) {
    if (gate.safe_handling.auto_execute_allowed || gate.safe_handling.protected_actions_executed) {
      errors.push({ path: `command_gates.${gate.command_gate_id}.safe_handling`, message: "Readiness gates must not execute commands or protected actions." });
    }
    if (gate.requires_explicit_human_approval && gate.command_allowed_now) {
      errors.push({ path: `command_gates.${gate.command_gate_id}.command_allowed_now`, message: "Protected commands must never be marked allowed now." });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeReadiness(actorReadiness, commandGates, manualRequirements, sources, runbookResult, verificationResult, validation) {
  return {
    readiness_status: deriveReadinessStatus(validation, runbookResult.value),
    source_available: sources.every((source) => source.available),
    source_runbook_status: runbookResult.value?.runbook_status ?? null,
    source_verification_status: verificationResult.value?.verification_status ?? null,
    source_runbook_step_count: runbookResult.value?.summary?.runbook_step_count ?? 0,
    source_actor_runbook_count: runbookResult.value?.summary?.actor_runbook_count ?? 0,
    actor_readiness_count: actorReadiness.length,
    command_gate_count: commandGates.length,
    manual_requirement_count: manualRequirements.length,
    allowed_command_count: commandGates.filter((gate) => gate.command_allowed_now).length,
    blocked_command_count: commandGates.filter((gate) => !gate.command_allowed_now).length,
    blocked_until_manual_input_count: commandGates.filter((gate) => gate.command_status === "blocked_until_manual_input").length,
    protected_command_count: commandGates.filter((gate) => gate.requires_explicit_human_approval).length,
    manual_input_required_count: manualRequirements.filter((requirement) => requirement.requirement_status === "manual_input_required").length,
    pending_human_input_count: runbookResult.value?.summary?.pending_human_input_count ?? 0,
    ready_for_validation_count: runbookResult.value?.summary?.ready_for_validation_count ?? 0,
    pending_prompt_count: runbookResult.value?.summary?.pending_prompt_count ?? 0,
    protected_action_count: runbookResult.value?.summary?.protected_action_count ?? 0,
    validation_error_count: validation.errors.length,
    by_required_actor: countBy(actorReadiness, "required_actor"),
    by_readiness_status: countBy(actorReadiness, "readiness_status"),
    by_command_status: countBy(commandGates, "command_status"),
    by_priority: countBy(actorReadiness, "priority"),
  };
}

function deriveReadinessStatus(validation, runbook) {
  if (!validation.valid) return "blocked";
  const summary = runbook?.summary ?? {};
  if ((summary.blocked_count ?? 0) > 0) return "blocked";
  if ((summary.attention_count ?? 0) > 0) return "attention";
  if ((summary.pending_human_input_count ?? 0) > 0) return "waiting_for_human_input";
  if ((summary.ready_for_validation_count ?? 0) > 0) return "ready_for_validation";
  return "clear";
}

function renderReadinessMarkdown(readiness) {
  const lines = [
    "# Human Review Cycle Receipt Completion Readiness",
    "",
    `- Readiness status: ${readiness.readiness_status}`,
    `- Actor readiness records: ${readiness.summary.actor_readiness_count}`,
    `- Command gates: ${readiness.summary.command_gate_count}`,
    `- Allowed commands now: ${readiness.summary.allowed_command_count}`,
    `- Blocked until manual input: ${readiness.summary.blocked_until_manual_input_count}`,
    `- Manual requirements: ${readiness.summary.manual_requirement_count}`,
    `- Validation errors: ${readiness.summary.validation_error_count}`,
    "",
    "## Allowed Now",
    "",
  ];
  for (const gate of readiness.command_gates.filter((item) => item.command_allowed_now)) {
    lines.push(`- ${gate.step_key}: \`${gate.command}\``);
  }
  lines.push("", "## Held Commands", "");
  for (const gate of readiness.command_gates.filter((item) => !item.command_allowed_now)) {
    lines.push(`- ${gate.step_key}: ${gate.command_status} - ${gate.blocked_reason}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderReadinessHtml(readiness) {
  const metricHtml = [
    ["Actors", readiness.summary.actor_readiness_count],
    ["Command Gates", readiness.summary.command_gate_count],
    ["Allowed Now", readiness.summary.allowed_command_count],
    ["Blocked", readiness.summary.blocked_command_count],
    ["Manual Input", readiness.summary.manual_input_required_count],
  ].map(([label, value]) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  const rowHtml = readiness.command_gates.map((gate) => `
    <tr>
      <td><span class="badge ${escapeHtml(gate.command_status)}">${escapeHtml(gate.command_status)}</span></td>
      <td>${escapeHtml(gate.step_rank)}</td>
      <td>${escapeHtml(gate.step_key)}</td>
      <td><code>${escapeHtml(gate.command)}</code></td>
      <td>${gate.command_allowed_now ? "yes" : "no"}</td>
      <td>${gate.requires_explicit_human_approval ? "yes" : "no"}</td>
      <td>${escapeHtml(gate.blocked_reason ?? "")}</td>
    </tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Human Review Cycle Receipt Completion Readiness</title>
  <style>
    :root { color-scheme: light; --ink:#18212f; --muted:#627084; --line:#d8dee8; --bg:#f7f9fc; --panel:#ffffff; --accent:#0f766e; --warn:#9f580a; --bad:#b42318; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: var(--bg); }
    header { padding: 28px 32px 20px; background: var(--panel); border-bottom: 1px solid var(--line); }
    h1 { margin: 0 0 8px; font-size: 24px; letter-spacing: 0; }
    main { padding: 24px 32px 40px; }
    .status { color: var(--muted); font-size: 14px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 18px 0; }
    .metric { border: 1px solid var(--line); background: var(--panel); padding: 12px; border-radius: 8px; }
    .metric span { display: block; color: var(--muted); font-size: 12px; }
    .metric strong { display: block; margin-top: 4px; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--line); }
    th, td { padding: 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; font-size: 13px; }
    th { color: var(--muted); font-weight: 700; background: #eef3f8; }
    code { white-space: normal; overflow-wrap: anywhere; font-size: 12px; color: #334155; }
    .badge { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: 3px 8px; white-space: nowrap; }
    .available_now { color: var(--accent); border-color: #9fd3ca; background: #ecfdf9; }
    .blocked_until_manual_input, .requires_explicit_human_approval { color: var(--warn); border-color: #f2c078; background: #fff8eb; }
    .blocked_by_validation_errors { color: var(--bad); border-color: #f0a9a2; background: #fff1f0; }
  </style>
</head>
<body>
  <header>
    <h1>Human Review Cycle Receipt Completion Readiness</h1>
    <div class="status">Status: ${escapeHtml(readiness.readiness_status)}. This gate only classifies command readiness; it executes nothing.</div>
  </header>
  <main>
    <section class="metrics">${metricHtml}</section>
    <table>
      <thead><tr><th>Status</th><th>Rank</th><th>Step</th><th>Command</th><th>Allowed Now</th><th>Approval</th><th>Reason</th></tr></thead>
      <tbody>${rowHtml}</tbody>
    </table>
  </main>
</body>
</html>
`;
}

function serializableReadiness(result) {
  return {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    readiness_id: result.readiness_id,
    output_dir: result.output_dir,
    readiness_status: result.readiness_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    actor_readiness: result.actor_readiness,
    command_gates: result.command_gates,
    manual_requirements: result.manual_requirements,
    validation: result.validation,
  };
}

async function readJsonOrError(filePath) {
  if (!filePath) return { ok: false, value: null, error: "disabled" };
  try {
    const value = JSON.parse(await readFile(filePath, "utf8"));
    return { ok: true, value, error: null };
  } catch (error) {
    return { ok: false, value: null, error: error.code === "ENOENT" ? "not_found" : error.message };
  }
}

function buildSource(sourceId, label, filePath, result) {
  return {
    source_id: sourceId,
    label,
    path: filePath,
    available: result.ok,
    schema_version: result.value?.schema_version ?? null,
    generated_at: result.value?.generated_at ?? null,
    summary: result.value?.summary ?? null,
    error: result.error ?? null,
  };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function compareActorReadiness(a, b) {
  return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || a.required_actor.localeCompare(b.required_actor);
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function dateStamp(value) {
  return value.replaceAll(":", "").replaceAll(".", "").replace("T", ".").replace("Z", "Z");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96) || "unknown";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") args.check = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--completion-runbook") args.completionRunbookPath = argv[++index];
    else if (arg === "--completion-verification") args.completionVerificationPath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-receipt-completion-readiness.mjs [options]

Options:
  --completion-runbook <path>     Human Review Cycle Receipt Completion Runbook artifact
  --completion-verification <path> Human Review Cycle Receipt Completion Verification artifact
  --out-dir <dir>                 Output directory
  --run-at <iso>                  Override generated_at
  --check                         Exit non-zero when structural validation fails
`);
}
