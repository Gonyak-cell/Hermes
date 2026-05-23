import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_RUNBOOK_OUT_DIR = "artifacts/human-review-cycle-receipt-completion-runbook/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_RUNBOOK_INPUTS = {
  completionWorkbenchPath: "artifacts/human-review-cycle-receipt-completion-workbench/latest/human-review-cycle-receipt-completion-workbench.json",
  completionVerificationPath: "artifacts/human-review-cycle-receipt-completion-verification/latest/human-review-cycle-receipt-completion-verification.json",
};

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const STATUS_ORDER = {
  blocked: 0,
  attention: 1,
  pending_human_input: 2,
  ready_for_validation: 3,
  clear: 4,
};

export async function runHumanReviewCycleReceiptCompletionRunbook(options = {}) {
  const result = await buildHumanReviewCycleReceiptCompletionRunbook(options);
  if (options.write !== false) await writeHumanReviewCycleReceiptCompletionRunbook(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle receipt completion runbook failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleReceiptCompletionRunbook(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_RUNBOOK_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const completionWorkbenchPath = path.resolve(options.completionWorkbenchPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_RUNBOOK_INPUTS.completionWorkbenchPath);
  const completionVerificationPath = path.resolve(options.completionVerificationPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_RUNBOOK_INPUTS.completionVerificationPath);
  const workbenchResult = await readJsonOrError(completionWorkbenchPath);
  const verificationResult = await readJsonOrError(completionVerificationPath);
  const workbenchItems = workbenchResult.value?.workbench_items ?? [];
  const actorWorkbenches = workbenchResult.value?.actor_workbenches ?? [];
  const runbookSteps = buildRunbookSteps(workbenchResult.value, verificationResult.value);
  const actorRunbooks = buildActorRunbooks(actorWorkbenches, workbenchItems, runbookSteps, outputDir);
  const sources = [
    buildSource("human_review_cycle_receipt_completion_workbench", "Human Review Cycle Receipt Completion Workbench", completionWorkbenchPath, workbenchResult),
    buildSource("human_review_cycle_receipt_completion_verification", "Human Review Cycle Receipt Completion Verification", completionVerificationPath, verificationResult),
  ];
  const validation = validateRunbook({ sources, workbenchResult, verificationResult, actorRunbooks, runbookSteps, workbenchItems });
  const runbook = {
    schema_version: "human-review-cycle-receipt-completion-runbook.v1",
    generated_at: generatedAt,
    runbook_id: `human-review-cycle-receipt-completion-runbook.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    runbook_status: deriveRunbookStatus(validation, workbenchItems),
    safe_handling: {
      auto_execute_allowed: false,
      draft_only: true,
      runbook_only: true,
      protected_actions_executed: false,
      receipt_edits_must_be_manual: true,
    },
    sources,
    summary: summarizeRunbook(actorRunbooks, runbookSteps, workbenchItems, sources, workbenchResult, verificationResult, validation),
    actor_runbooks: actorRunbooks,
    runbook_steps: runbookSteps,
    validation,
  };

  return {
    ...runbook,
    markdown: renderRunbookMarkdown(runbook),
    html: renderRunbookHtml(runbook),
  };
}

export async function writeHumanReviewCycleReceiptCompletionRunbook(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-receipt-completion-runbook.json"), serializableRunbook(result));
  await writeJson(path.join(outDir, "runbook-steps.json"), {
    generated_at: result.generated_at,
    count: result.runbook_steps.length,
    runbook_steps: result.runbook_steps,
  });
  await writeJson(path.join(outDir, "actor-runbooks.json"), {
    generated_at: result.generated_at,
    count: result.actor_runbooks.length,
    actor_runbooks: result.actor_runbooks,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
  for (const actor of result.actor_runbooks) {
    const actorDir = path.join(outDir, "actors", actor.required_actor);
    await mkdir(actorDir, { recursive: true });
    await writeJson(path.join(actorDir, "completion-runbook.json"), {
      generated_at: result.generated_at,
      required_actor: actor.required_actor,
      runbook_status: actor.runbook_status,
      actor_runbook: actor,
      runbook_steps: result.runbook_steps,
    });
    await writeFile(path.join(actorDir, "completion-runbook.md"), renderActorRunbookMarkdown(actor, result.runbook_steps), "utf8");
    await writeFile(path.join(actorDir, "completion-runbook.html"), renderActorRunbookHtml(actor, result.runbook_steps), "utf8");
  }
}

export async function runHumanReviewCycleReceiptCompletionRunbookCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleReceiptCompletionRunbook(args);
    console.log(`Human review cycle receipt completion runbook ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Runbook status: ${result.runbook_status}`);
    console.log(`Actor runbooks: ${result.summary.actor_runbook_count}`);
    console.log(`Runbook steps: ${result.summary.runbook_step_count}`);
    console.log(`Pending human input: ${result.summary.pending_human_input_count}`);
    console.log(`Pending prompt fields: ${result.summary.pending_prompt_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildRunbookSteps(workbench, verification) {
  const summary = workbench?.summary ?? {};
  const pendingHumanInput = summary.pending_human_input_count ?? 0;
  const readyForValidation = pendingHumanInput === 0 && (summary.ready_for_validation_count ?? 0) > 0;
  const validationErrors = verification?.summary?.validation_error_count ?? verification?.validation?.errors?.length ?? 0;
  const commandStatus = pendingHumanInput > 0 ? "pending_human_input" : validationErrors > 0 ? "attention" : readyForValidation ? "ready_for_validation" : "clear";
  const manualStatus = pendingHumanInput > 0 ? "pending_human_input" : validationErrors > 0 ? "attention" : "clear";
  return [
    manualStep(1, "open_completion_workbench", manualStatus, "Open the global completion workbench and confirm the actor/item counts before editing receipt inputs.", {
      artifact_path: workbench?.output_dir ? path.join(workbench.output_dir, "index.html") : null,
    }),
    manualStep(2, "open_actor_completion_template", manualStatus, "Open each actor completion template and use it as the checklist for receipt fields.", {
      actor_artifact_field: "receipt_completion_template_path",
    }),
    manualStep(3, "manually_fill_target_receipt_inputs", manualStatus, "Manually fill every pending target receipt input field; do not let the harness auto-edit receipt files.", {
      pending_prompt_count: summary.pending_prompt_count ?? 0,
      target_file_count: summary.target_file_count ?? 0,
    }),
    commandStep(4, "rerun_completion_verification", commandStatus, "Rerun completion verification after manual receipt edits.", "npm run control-plane:review-cycle:completion-verify"),
    commandStep(5, "rerun_completion_workbench", commandStatus, "Regenerate the workbench so pending fields and actor views reflect the manual edits.", "npm run control-plane:review-cycle:completion-workbench"),
    commandStep(6, "rerun_correction_merge", commandStatus, "Merge the corrected human-review receipt inputs only after the completion verification is ready.", "npm run control-plane:review-corrections:merge"),
    commandStep(7, "rerun_correction_validation", commandStatus, "Validate corrected receipts before any future application.", "npm run control-plane:review-corrections:validate"),
    commandStep(8, "rerun_receipt_field_audit", commandStatus, "Re-audit required receipt fields to catch missing or invalid values after correction merge.", "npm run control-plane:review-cycle:field-audit"),
    commandStep(9, "rebuild_dashboard", commandStatus, "Rebuild dashboard status after manual input and validation artifacts are refreshed.", "npm run dashboard:build"),
    commandStep(10, "rerun_api_smoke", commandStatus, "Smoke-test the read-only API surface after dashboard rebuild.", "npm run api:smoke"),
    protectedManualStep(11, "apply_human_gate_receipts_after_explicit_approval", pendingHumanInput > 0 ? "pending_human_input" : "ready_for_validation", "Only after explicit human approval, apply validated human gate receipts. This runbook never performs the application step automatically.", "npm run control-plane:human-gate-receipts:apply"),
  ];
}

function manualStep(rank, key, status, instruction, refs = {}) {
  return buildStep({ rank, key, status, stepType: "manual", instruction, command: null, commandMayBeRunByHuman: false, requiresExplicitHumanApproval: false, refs });
}

function commandStep(rank, key, status, instruction, command) {
  return buildStep({ rank, key, status, stepType: "command", instruction, command, commandMayBeRunByHuman: true, requiresExplicitHumanApproval: false, refs: {} });
}

function protectedManualStep(rank, key, status, instruction, command) {
  return buildStep({ rank, key, status, stepType: "protected_manual", instruction, command, commandMayBeRunByHuman: false, requiresExplicitHumanApproval: true, refs: {} });
}

function buildStep({ rank, key, status, stepType, instruction, command, commandMayBeRunByHuman, requiresExplicitHumanApproval, refs }) {
  return {
    runbook_step_id: `human-review-cycle-receipt-completion-runbook.step.${String(rank).padStart(2, "0")}.${key}`,
    step_rank: rank,
    step_key: key,
    step_type: stepType,
    step_status: status,
    instruction,
    command,
    command_may_be_run_by_human: commandMayBeRunByHuman,
    requires_explicit_human_approval: requiresExplicitHumanApproval,
    source_refs: refs,
    safe_handling: {
      auto_execute_allowed: false,
      runbook_only: true,
      protected_actions_executed: false,
      receipt_edits_must_be_manual: true,
    },
  };
}

function buildActorRunbooks(actorWorkbenches, workbenchItems, runbookSteps, outputDir) {
  return (actorWorkbenches ?? []).map((actor) => {
    const actorItems = workbenchItems.filter((item) => item.required_actor === actor.required_actor);
    return {
      actor_runbook_id: `human-review-cycle-receipt-completion-runbook.actor.${slugify(actor.required_actor)}`,
      actor_workbench_id: actor.actor_workbench_id,
      required_actor: actor.required_actor,
      runbook_status: actor.workbench_status,
      priority: actor.priority,
      workbench_item_count: actor.workbench_item_count ?? actorItems.length,
      pending_human_input_count: actor.pending_human_input_count ?? actorItems.filter((item) => item.workbench_status === "pending_human_input").length,
      ready_for_validation_count: actor.ready_for_validation_count ?? actorItems.filter((item) => item.workbench_status === "ready_for_validation").length,
      attention_count: actor.attention_count ?? actorItems.filter((item) => item.workbench_status === "attention").length,
      blocked_count: actor.blocked_count ?? actorItems.filter((item) => item.workbench_status === "blocked").length,
      target_file_count: actor.target_file_count ?? new Set(actorItems.map((item) => item.target_receipt_input_path).filter(Boolean)).size,
      field_prompt_count: actor.field_prompt_count ?? sum(actorItems.map((item) => item.field_prompt_count)),
      completed_prompt_count: actor.completed_prompt_count ?? sum(actorItems.map((item) => item.completed_prompt_count)),
      pending_prompt_count: actor.pending_prompt_count ?? sum(actorItems.map((item) => item.pending_prompt_count)),
      invalid_prompt_count: actor.invalid_prompt_count ?? sum(actorItems.map((item) => item.invalid_prompt_count)),
      command_step_count: runbookSteps.filter((step) => step.step_type === "command").length,
      manual_step_count: runbookSteps.filter((step) => step.step_type === "manual").length,
      protected_step_count: runbookSteps.filter((step) => step.step_type === "protected_manual").length,
      workbench_item_ids: actor.workbench_item_ids ?? actorItems.map((item) => item.workbench_item_id),
      pending_fields: unique(actorItems.flatMap((item) => item.pending_fields ?? [])),
      workbench_html_path: actor.workbench_html_path ?? null,
      workbench_markdown_path: actor.workbench_markdown_path ?? null,
      receipt_completion_template_path: actor.receipt_completion_template_path ?? null,
      completion_runbook_json_path: path.join(outputDir, "actors", actor.required_actor, "completion-runbook.json"),
      completion_runbook_markdown_path: path.join(outputDir, "actors", actor.required_actor, "completion-runbook.md"),
      completion_runbook_html_path: path.join(outputDir, "actors", actor.required_actor, "completion-runbook.html"),
      next_command_sequence: runbookSteps.filter((step) => step.command).map((step) => ({
        step_key: step.step_key,
        command: step.command,
        command_may_be_run_by_human: step.command_may_be_run_by_human,
        requires_explicit_human_approval: step.requires_explicit_human_approval,
      })),
      safe_handling: {
        auto_execute_allowed: false,
        draft_only: true,
        runbook_only: true,
        protected_actions_executed: false,
        receipt_edits_must_be_manual: true,
      },
    };
  }).sort(compareActorRunbooks);
}

function validateRunbook({ sources, workbenchResult, verificationResult, actorRunbooks, runbookSteps, workbenchItems }) {
  const errors = [];
  for (const source of sources) {
    if (!source.available) errors.push({ path: `sources.${source.source_id}`, message: `${source.label} unavailable: ${source.error}` });
  }
  const expectedItemCount = workbenchResult.value?.summary?.workbench_item_count ?? 0;
  const expectedActorCount = workbenchResult.value?.summary?.actor_workbench_count ?? 0;
  if (expectedItemCount > 0 && workbenchItems.length !== expectedItemCount) {
    errors.push({ path: "workbench_items", message: "Runbook workbench item count must match source workbench item count." });
  }
  if (expectedActorCount > 0 && actorRunbooks.length !== expectedActorCount) {
    errors.push({ path: "actor_runbooks", message: "Actor runbook count must match source actor workbench count." });
  }
  if (verificationResult.ok) {
    const expectedVerificationCount = verificationResult.value?.summary?.verification_item_count ?? 0;
    if (expectedVerificationCount > 0 && expectedVerificationCount !== workbenchItems.length) {
      errors.push({ path: "sources.human_review_cycle_receipt_completion_verification.summary.verification_item_count", message: "Completion verification and workbench item counts must agree." });
    }
  }
  for (const actor of actorRunbooks) {
    if (!actor.workbench_html_path) {
      errors.push({ path: `actor_runbooks.${actor.actor_runbook_id}.workbench_html_path`, message: "Actor runbook must link back to the actor workbench HTML." });
    }
    if (!actor.receipt_completion_template_path) {
      errors.push({ path: `actor_runbooks.${actor.actor_runbook_id}.receipt_completion_template_path`, message: "Actor runbook must link to a receipt completion template." });
    }
    if (actor.safe_handling.auto_execute_allowed || actor.safe_handling.protected_actions_executed) {
      errors.push({ path: `actor_runbooks.${actor.actor_runbook_id}.safe_handling`, message: "Actor runbook must remain read-only." });
    }
  }
  for (const step of runbookSteps) {
    if (step.safe_handling.auto_execute_allowed || step.safe_handling.protected_actions_executed) {
      errors.push({ path: `runbook_steps.${step.runbook_step_id}.safe_handling`, message: "Runbook steps must not execute commands or protected actions." });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeRunbook(actorRunbooks, runbookSteps, workbenchItems, sources, workbenchResult, verificationResult, validation) {
  return {
    runbook_status: deriveRunbookStatus(validation, workbenchItems),
    source_available: sources.every((source) => source.available),
    source_workbench_status: workbenchResult.value?.workbench_status ?? null,
    source_verification_status: verificationResult.value?.verification_status ?? null,
    source_workbench_item_count: workbenchResult.value?.summary?.workbench_item_count ?? 0,
    source_actor_workbench_count: workbenchResult.value?.summary?.actor_workbench_count ?? 0,
    actor_runbook_count: actorRunbooks.length,
    runbook_step_count: runbookSteps.length,
    workbench_item_count: workbenchItems.length,
    pending_human_input_count: workbenchItems.filter((item) => item.workbench_status === "pending_human_input").length,
    ready_for_validation_count: workbenchItems.filter((item) => item.workbench_status === "ready_for_validation").length,
    attention_count: workbenchItems.filter((item) => item.workbench_status === "attention").length,
    blocked_count: workbenchItems.filter((item) => item.workbench_status === "blocked").length,
    target_file_count: new Set(workbenchItems.map((item) => item.target_receipt_input_path).filter(Boolean)).size,
    field_prompt_count: sum(workbenchItems.map((item) => item.field_prompt_count)),
    completed_prompt_count: sum(workbenchItems.map((item) => item.completed_prompt_count)),
    pending_prompt_count: sum(workbenchItems.map((item) => item.pending_prompt_count)),
    invalid_prompt_count: sum(workbenchItems.map((item) => item.invalid_prompt_count)),
    protected_action_count: workbenchItems.filter((item) => item.protected_action).length,
    evidence_decision_count: workbenchItems.filter((item) => item.evidence_decision).length,
    command_step_count: runbookSteps.filter((step) => step.step_type === "command").length,
    manual_step_count: runbookSteps.filter((step) => step.step_type === "manual").length,
    protected_step_count: runbookSteps.filter((step) => step.step_type === "protected_manual").length,
    validation_error_count: validation.errors.length,
    by_required_actor: countBy(workbenchItems, "required_actor"),
    by_step_type: countBy(runbookSteps, "step_type"),
    by_step_status: countBy(runbookSteps, "step_status"),
    by_priority: countBy(actorRunbooks, "priority"),
  };
}

function deriveRunbookStatus(validation, items) {
  if (!validation.valid) return "blocked";
  if (items.some((item) => item.workbench_status === "blocked")) return "blocked";
  if (items.some((item) => item.workbench_status === "attention")) return "attention";
  if (items.some((item) => item.workbench_status === "pending_human_input")) return "pending_human_input";
  if (items.some((item) => item.workbench_status === "ready_for_validation")) return "ready_for_validation";
  return "clear";
}

function renderRunbookMarkdown(runbook) {
  const lines = [
    "# Human Review Cycle Receipt Completion Runbook",
    "",
    `- Runbook status: ${runbook.runbook_status}`,
    `- Actor runbooks: ${runbook.summary.actor_runbook_count}`,
    `- Runbook steps: ${runbook.summary.runbook_step_count}`,
    `- Pending human input: ${runbook.summary.pending_human_input_count}`,
    `- Pending prompt fields: ${runbook.summary.pending_prompt_count}`,
    `- Validation errors: ${runbook.summary.validation_error_count}`,
    "",
    "## Safe Handling",
    "",
    "- This runbook is read-only.",
    "- It does not edit target receipt inputs.",
    "- It does not apply receipts or execute protected actions.",
    "- Protected application remains a separate, explicit human approval step.",
    "",
    "## Steps",
    "",
  ];
  for (const step of runbook.runbook_steps) {
    lines.push(`${step.step_rank}. ${step.step_key}: ${step.instruction}`);
    if (step.command) lines.push(`   Command: \`${step.command}\``);
  }
  lines.push("", "## Actor Runbooks", "");
  for (const actor of runbook.actor_runbooks) {
    lines.push(`- ${actor.required_actor}: ${actor.workbench_item_count} item(s), ${actor.pending_prompt_count} pending prompt field(s), ${actor.completion_runbook_html_path}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderActorRunbookMarkdown(actor, steps) {
  const lines = [
    `# Human Review Receipt Completion Runbook: ${actor.required_actor}`,
    "",
    `- Runbook status: ${actor.runbook_status}`,
    `- Workbench items: ${actor.workbench_item_count}`,
    `- Pending human input: ${actor.pending_human_input_count}`,
    `- Pending prompt fields: ${actor.pending_prompt_count}`,
    `- Actor workbench: ${actor.workbench_html_path ?? "not available"}`,
    `- Completion template: ${actor.receipt_completion_template_path ?? "not available"}`,
    "",
    "## Manual Inputs",
    "",
    `- Target files: ${actor.target_file_count}`,
    `- Pending fields: ${actor.pending_fields.join(", ") || "none"}`,
    "",
    "## Steps",
    "",
  ];
  for (const step of steps) {
    lines.push(`${step.step_rank}. ${step.step_key}: ${step.instruction}`);
    if (step.command) lines.push(`   Command: \`${step.command}\``);
  }
  return `${lines.join("\n")}\n`;
}

function renderRunbookHtml(runbook) {
  return renderHtmlPage({
    title: "Human Review Cycle Receipt Completion Runbook",
    status: runbook.runbook_status,
    metrics: [
      ["Actors", runbook.summary.actor_runbook_count],
      ["Steps", runbook.summary.runbook_step_count],
      ["Pending", runbook.summary.pending_human_input_count],
      ["Pending Fields", runbook.summary.pending_prompt_count],
      ["Errors", runbook.summary.validation_error_count],
    ],
    steps: runbook.runbook_steps,
    actorLinks: runbook.actor_runbooks.map((actor) => ({
      label: actor.required_actor,
      href: `actors/${actor.required_actor}/completion-runbook.html`,
      count: actor.pending_prompt_count,
    })),
  });
}

function renderActorRunbookHtml(actor, steps) {
  return renderHtmlPage({
    title: `Human Review Receipt Completion Runbook: ${actor.required_actor}`,
    status: actor.runbook_status,
    metrics: [
      ["Items", actor.workbench_item_count],
      ["Pending", actor.pending_human_input_count],
      ["Ready", actor.ready_for_validation_count],
      ["Pending Fields", actor.pending_prompt_count],
      ["Commands", actor.command_step_count],
    ],
    steps,
    actorLinks: [
      {
        label: "Completion Workbench",
        href: pathToFileHref(actor.workbench_html_path),
        count: actor.workbench_item_count,
      },
      {
        label: "Completion Template",
        href: pathToFileHref(actor.receipt_completion_template_path),
        count: actor.field_prompt_count,
      },
    ],
  });
}

function renderHtmlPage({ title, status, metrics, steps, actorLinks }) {
  const metricHtml = metrics.map(([label, value]) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  const actorHtml = actorLinks.map((link) => `<a class="actor-link" href="${escapeHtml(link.href)}">${escapeHtml(link.label)} <span>${escapeHtml(link.count)}</span></a>`).join("");
  const rowHtml = steps.map((step) => `
    <tr>
      <td><span class="badge ${escapeHtml(step.step_status)}">${escapeHtml(step.step_status)}</span></td>
      <td>${escapeHtml(step.step_rank)}</td>
      <td>${escapeHtml(step.step_type)}</td>
      <td>${escapeHtml(step.step_key)}</td>
      <td>${escapeHtml(step.instruction)}</td>
      <td><code>${escapeHtml(step.command ?? "")}</code></td>
      <td>${step.requires_explicit_human_approval ? "yes" : "no"}</td>
    </tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
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
    .actors { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
    .actor-link { border: 1px solid var(--line); background: var(--panel); color: var(--ink); padding: 8px 10px; border-radius: 8px; text-decoration: none; font-size: 13px; }
    .actor-link span { color: var(--muted); margin-left: 6px; }
    table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--line); }
    th, td { padding: 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; font-size: 13px; }
    th { color: var(--muted); font-weight: 700; background: #eef3f8; }
    code { white-space: normal; overflow-wrap: anywhere; font-size: 12px; color: #334155; }
    .badge { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: 3px 8px; white-space: nowrap; }
    .pending_human_input { color: var(--warn); border-color: #f2c078; background: #fff8eb; }
    .ready_for_validation, .clear { color: var(--accent); border-color: #9fd3ca; background: #ecfdf9; }
    .attention, .blocked { color: var(--bad); border-color: #f0a9a2; background: #fff1f0; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <div class="status">Status: ${escapeHtml(status)}. Read-only runbook; receipt edits and protected application remain manual.</div>
  </header>
  <main>
    <section class="metrics">${metricHtml}</section>
    <nav class="actors">${actorHtml}</nav>
    <table>
      <thead><tr><th>Status</th><th>Rank</th><th>Type</th><th>Step</th><th>Instruction</th><th>Command</th><th>Approval</th></tr></thead>
      <tbody>${rowHtml}</tbody>
    </table>
  </main>
</body>
</html>
`;
}

function serializableRunbook(result) {
  return {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    runbook_id: result.runbook_id,
    output_dir: result.output_dir,
    runbook_status: result.runbook_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    actor_runbooks: result.actor_runbooks,
    runbook_steps: result.runbook_steps,
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

function compareActorRunbooks(a, b) {
  return (STATUS_ORDER[a.runbook_status] ?? 99) - (STATUS_ORDER[b.runbook_status] ?? 99)
    || (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || a.required_actor.localeCompare(b.required_actor);
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function pathToFileHref(value) {
  if (!value) return "#";
  return `file://${value}`;
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
    else if (arg === "--completion-workbench") args.completionWorkbenchPath = argv[++index];
    else if (arg === "--completion-verification") args.completionVerificationPath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-receipt-completion-runbook.mjs [options]

Options:
  --completion-workbench <path>   Human Review Cycle Receipt Completion Workbench artifact
  --completion-verification <path> Human Review Cycle Receipt Completion Verification artifact
  --out-dir <dir>                 Output directory
  --run-at <iso>                  Override generated_at
  --check                         Exit non-zero when structural validation fails
`);
}
