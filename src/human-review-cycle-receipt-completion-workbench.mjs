import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_WORKBENCH_OUT_DIR = "artifacts/human-review-cycle-receipt-completion-workbench/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_WORKBENCH_INPUTS = {
  completionVerificationPath: "artifacts/human-review-cycle-receipt-completion-verification/latest/human-review-cycle-receipt-completion-verification.json",
  completionPackPath: "artifacts/human-review-cycle-receipt-completion-pack/latest/human-review-cycle-receipt-completion-pack.json",
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

export async function runHumanReviewCycleReceiptCompletionWorkbench(options = {}) {
  const result = await buildHumanReviewCycleReceiptCompletionWorkbench(options);
  if (options.write !== false) await writeHumanReviewCycleReceiptCompletionWorkbench(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle receipt completion workbench failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleReceiptCompletionWorkbench(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_WORKBENCH_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const completionVerificationPath = path.resolve(options.completionVerificationPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_WORKBENCH_INPUTS.completionVerificationPath);
  const completionPackPath = path.resolve(options.completionPackPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_RECEIPT_COMPLETION_WORKBENCH_INPUTS.completionPackPath);
  const verificationResult = await readJsonOrError(completionVerificationPath);
  const packResult = await readJsonOrError(completionPackPath);
  const templatePathByActor = new Map((packResult.value?.actor_completion_packs ?? []).map((actor) => [actor.required_actor, actor.receipt_completion_template_path]));
  const workbenchItems = buildWorkbenchItems(verificationResult.value?.verification_items ?? [], templatePathByActor);
  const actorWorkbenches = buildActorWorkbenches(verificationResult.value?.actor_verifications ?? [], workbenchItems, outputDir, templatePathByActor);
  const sources = [
    buildSource("human_review_cycle_receipt_completion_verification", "Human Review Cycle Receipt Completion Verification", completionVerificationPath, verificationResult),
    buildSource("human_review_cycle_receipt_completion_pack", "Human Review Cycle Receipt Completion Pack", completionPackPath, packResult),
  ];
  const validation = validateWorkbench({ sources, verificationResult, packResult, actorWorkbenches, workbenchItems });
  const workbench = {
    schema_version: "human-review-cycle-receipt-completion-workbench.v1",
    generated_at: generatedAt,
    workbench_id: `human-review-cycle-receipt-completion-workbench.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    workbench_status: deriveWorkbenchStatus(validation, workbenchItems),
    safe_handling: {
      auto_execute_allowed: false,
      draft_only: true,
      workbench_only: true,
      protected_actions_executed: false,
      receipt_edits_must_be_manual: true,
    },
    sources,
    summary: summarizeWorkbench(actorWorkbenches, workbenchItems, sources, verificationResult, packResult, validation),
    actor_workbenches: actorWorkbenches,
    workbench_items: workbenchItems,
    validation,
  };

  return {
    ...workbench,
    markdown: renderWorkbenchMarkdown(workbench),
    html: renderWorkbenchHtml(workbench),
  };
}

export async function writeHumanReviewCycleReceiptCompletionWorkbench(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-receipt-completion-workbench.json"), serializableWorkbench(result));
  await writeJson(path.join(outDir, "workbench-items.json"), {
    generated_at: result.generated_at,
    count: result.workbench_items.length,
    workbench_items: result.workbench_items,
  });
  await writeJson(path.join(outDir, "actor-workbenches.json"), {
    generated_at: result.generated_at,
    count: result.actor_workbenches.length,
    actor_workbenches: result.actor_workbenches,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
  for (const actor of result.actor_workbenches) {
    const actorDir = path.join(outDir, "actors", actor.required_actor);
    const items = result.workbench_items.filter((item) => item.required_actor === actor.required_actor);
    await mkdir(actorDir, { recursive: true });
    await writeJson(path.join(actorDir, "completion-workbench.json"), {
      generated_at: result.generated_at,
      required_actor: actor.required_actor,
      workbench_status: actor.workbench_status,
      count: items.length,
      actor_workbench: actor,
      workbench_items: items,
    });
    await writeFile(path.join(actorDir, "completion-workbench.md"), renderActorWorkbenchMarkdown(actor, items), "utf8");
    await writeFile(path.join(actorDir, "completion-workbench.html"), renderActorWorkbenchHtml(actor, items), "utf8");
  }
}

export async function runHumanReviewCycleReceiptCompletionWorkbenchCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleReceiptCompletionWorkbench(args);
    console.log(`Human review cycle receipt completion workbench ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Workbench status: ${result.workbench_status}`);
    console.log(`Actor workbenches: ${result.summary.actor_workbench_count}`);
    console.log(`Workbench items: ${result.summary.workbench_item_count}`);
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

function buildWorkbenchItems(verificationItems, templatePathByActor) {
  return verificationItems.map((item) => {
    const pendingFields = item.field_results?.filter((field) => field.field_status === "pending").map((field) => field.field_name) ?? [];
    const invalidFields = item.field_results?.filter((field) => field.field_status === "invalid").map((field) => field.field_name) ?? [];
    const completedFields = item.field_results?.filter((field) => field.field_status === "complete").map((field) => field.field_name) ?? [];
    return {
      workbench_item_id: `human-review-cycle-receipt-completion-workbench.${slugify(item.gate_item_id)}`,
      verification_item_id: item.verification_item_id,
      completion_item_id: item.completion_item_id,
      field_audit_item_id: item.field_audit_item_id,
      console_item_id: item.console_item_id,
      gate_item_id: item.gate_item_id,
      receipt_id: item.receipt_id,
      required_actor: item.required_actor,
      gate_type: item.gate_type,
      priority: item.priority,
      workbench_status: item.verification_status,
      verification_status: item.verification_status,
      protected_action: Boolean(item.protected_action),
      evidence_decision: Boolean(item.evidence_decision),
      target_receipt_input_path: item.target_receipt_input_path,
      receipt_completion_template_path: templatePathByActor.get(item.required_actor) ?? null,
      field_prompt_count: item.field_prompt_count ?? 0,
      completed_prompt_count: item.completed_prompt_count ?? 0,
      pending_prompt_count: item.pending_prompt_count ?? 0,
      invalid_prompt_count: item.invalid_prompt_count ?? 0,
      pending_fields: pendingFields,
      invalid_fields: invalidFields,
      completed_fields: completedFields,
      field_results: item.field_results ?? [],
      manual_instruction: buildManualInstruction(item, pendingFields, invalidFields),
      next_actions: buildWorkbenchNextActions(item.verification_status),
      source_refs: {
        verification_item_id: item.verification_item_id,
        completion_item_id: item.completion_item_id,
        target_receipt_input_path: item.target_receipt_input_path,
      },
      safe_handling: {
        auto_execute_allowed: false,
        protected_actions_executed: false,
        workbench_only: true,
        receipt_edits_must_be_manual: true,
      },
    };
  }).sort(compareWorkbenchItems).map((item, index) => ({ ...item, workbench_rank: index + 1 }));
}

function buildActorWorkbenches(actorVerifications, workbenchItems, outputDir, templatePathByActor) {
  const sourceByActor = new Map((actorVerifications ?? []).map((actor) => [actor.required_actor, actor]));
  return Object.entries(groupBy(workbenchItems, (item) => item.required_actor))
    .map(([requiredActor, items]) => {
      const sourceActor = sourceByActor.get(requiredActor);
      return {
        actor_workbench_id: `human-review-cycle-receipt-completion-workbench.actor.${slugify(requiredActor)}`,
        actor_verification_id: sourceActor?.actor_verification_id ?? null,
        required_actor: requiredActor,
        workbench_status: deriveActorWorkbenchStatus(items),
        priority: highestPriority(items),
        workbench_item_count: items.length,
        pending_human_input_count: items.filter((item) => item.workbench_status === "pending_human_input").length,
        ready_for_validation_count: items.filter((item) => item.workbench_status === "ready_for_validation").length,
        attention_count: items.filter((item) => item.workbench_status === "attention").length,
        blocked_count: items.filter((item) => item.workbench_status === "blocked").length,
        target_file_count: new Set(items.map((item) => item.target_receipt_input_path).filter(Boolean)).size,
        field_prompt_count: sum(items.map((item) => item.field_prompt_count)),
        completed_prompt_count: sum(items.map((item) => item.completed_prompt_count)),
        pending_prompt_count: sum(items.map((item) => item.pending_prompt_count)),
        invalid_prompt_count: sum(items.map((item) => item.invalid_prompt_count)),
        workbench_item_ids: items.map((item) => item.workbench_item_id),
        receipt_completion_template_path: templatePathByActor.get(requiredActor) ?? null,
        workbench_json_path: path.join(outputDir, "actors", requiredActor, "completion-workbench.json"),
        workbench_markdown_path: path.join(outputDir, "actors", requiredActor, "completion-workbench.md"),
        workbench_html_path: path.join(outputDir, "actors", requiredActor, "completion-workbench.html"),
        safe_handling: {
          auto_execute_allowed: false,
          draft_only: true,
          workbench_only: true,
          protected_actions_executed: false,
          receipt_edits_must_be_manual: true,
        },
      };
    })
    .sort(compareActorWorkbenches);
}

function validateWorkbench({ sources, verificationResult, packResult, actorWorkbenches, workbenchItems }) {
  const errors = [];
  for (const source of sources) {
    if (!source.available) errors.push({ path: `sources.${source.source_id}`, message: `${source.label} unavailable: ${source.error}` });
  }
  const expectedItemCount = verificationResult.value?.summary?.verification_item_count ?? 0;
  const expectedActorCount = verificationResult.value?.summary?.actor_verification_count ?? 0;
  if (expectedItemCount > 0 && workbenchItems.length !== expectedItemCount) {
    errors.push({ path: "workbench_items", message: "Workbench item count must match completion verification item count." });
  }
  if (expectedActorCount > 0 && actorWorkbenches.length !== expectedActorCount) {
    errors.push({ path: "actor_workbenches", message: "Actor workbench count must match actor verification count." });
  }
  for (const actor of actorWorkbenches) {
    if (packResult.ok && !actor.receipt_completion_template_path) {
      errors.push({ path: `actor_workbenches.${actor.actor_workbench_id}.receipt_completion_template_path`, message: "Actor workbench must link to a receipt completion template." });
    }
  }
  for (const item of workbenchItems) {
    if (item.safe_handling.auto_execute_allowed || item.safe_handling.protected_actions_executed) {
      errors.push({ path: `workbench_items.${item.workbench_item_id}.safe_handling`, message: "Receipt completion workbench must not execute protected actions." });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeWorkbench(actorWorkbenches, workbenchItems, sources, verificationResult, packResult, validation) {
  return {
    workbench_status: deriveWorkbenchStatus(validation, workbenchItems),
    source_available: sources.every((source) => source.available),
    source_verification_status: verificationResult.value?.verification_status ?? null,
    source_completion_status: packResult.value?.completion_status ?? null,
    source_verification_item_count: verificationResult.value?.summary?.verification_item_count ?? 0,
    source_actor_verification_count: verificationResult.value?.summary?.actor_verification_count ?? 0,
    actor_workbench_count: actorWorkbenches.length,
    workbench_item_count: workbenchItems.length,
    pending_human_input_count: workbenchItems.filter((item) => item.workbench_status === "pending_human_input").length,
    ready_for_validation_count: workbenchItems.filter((item) => item.workbench_status === "ready_for_validation").length,
    attention_count: workbenchItems.filter((item) => item.workbench_status === "attention").length,
    blocked_count: workbenchItems.filter((item) => item.workbench_status === "blocked").length,
    target_file_count: new Set(workbenchItems.map((item) => item.target_receipt_input_path).filter(Boolean)).size,
    receipt_completion_template_count: new Set(actorWorkbenches.map((actor) => actor.receipt_completion_template_path).filter(Boolean)).size,
    field_prompt_count: sum(workbenchItems.map((item) => item.field_prompt_count)),
    completed_prompt_count: sum(workbenchItems.map((item) => item.completed_prompt_count)),
    pending_prompt_count: sum(workbenchItems.map((item) => item.pending_prompt_count)),
    invalid_prompt_count: sum(workbenchItems.map((item) => item.invalid_prompt_count)),
    protected_action_count: workbenchItems.filter((item) => item.protected_action).length,
    evidence_decision_count: workbenchItems.filter((item) => item.evidence_decision).length,
    validation_error_count: validation.errors.length,
    by_required_actor: countBy(workbenchItems, "required_actor"),
    by_gate_type: countBy(workbenchItems, "gate_type"),
    by_workbench_status: countBy(workbenchItems, "workbench_status"),
    by_priority: countBy(workbenchItems, "priority"),
  };
}

function deriveWorkbenchStatus(validation, items) {
  if (!validation.valid) return "blocked";
  if (items.some((item) => item.workbench_status === "blocked")) return "blocked";
  if (items.some((item) => item.workbench_status === "attention")) return "attention";
  if (items.some((item) => item.workbench_status === "pending_human_input")) return "pending_human_input";
  if (items.some((item) => item.workbench_status === "ready_for_validation")) return "ready_for_validation";
  return "clear";
}

function deriveActorWorkbenchStatus(items) {
  if (items.some((item) => item.workbench_status === "blocked")) return "blocked";
  if (items.some((item) => item.workbench_status === "attention")) return "attention";
  if (items.some((item) => item.workbench_status === "pending_human_input")) return "pending_human_input";
  if (items.some((item) => item.workbench_status === "ready_for_validation")) return "ready_for_validation";
  return "clear";
}

function buildManualInstruction(item, pendingFields, invalidFields) {
  if (item.verification_status === "pending_human_input") return `Fill ${pendingFields.length} pending field(s) in the target receipt input, using the actor completion template as the source checklist.`;
  if (item.verification_status === "ready_for_validation") return "Receipt row appears complete; rerun validation before any application.";
  if (item.verification_status === "attention") return `Repair invalid field(s): ${invalidFields.join(", ") || "unknown"}.`;
  if (item.verification_status === "blocked") return "Repair missing target files or rows before asking the actor to complete this receipt.";
  return "No action required.";
}

function buildWorkbenchNextActions(status) {
  if (status === "pending_human_input") return ["open_actor_workbench", "open_completion_template", "manually_fill_target_receipt_input", "rerun_completion_verification"];
  if (status === "ready_for_validation") return ["rerun_correction_merge", "rerun_correction_validation", "rerun_receipt_field_audit"];
  if (status === "attention") return ["repair_invalid_receipt_values", "rerun_completion_verification", "rerun_completion_workbench"];
  if (status === "blocked") return ["regenerate_completion_pack", "regenerate_completion_verification", "rerun_completion_workbench"];
  return ["no_action_required"];
}

function renderWorkbenchMarkdown(workbench) {
  const lines = [
    "# Human Review Cycle Receipt Completion Workbench",
    "",
    `- Workbench status: ${workbench.workbench_status}`,
    `- Actor workbenches: ${workbench.summary.actor_workbench_count}`,
    `- Workbench items: ${workbench.summary.workbench_item_count}`,
    `- Pending human input: ${workbench.summary.pending_human_input_count}`,
    `- Pending prompt fields: ${workbench.summary.pending_prompt_count}`,
    `- Validation errors: ${workbench.summary.validation_error_count}`,
    "",
    "## Safe Handling",
    "",
    "- This workbench is read-only.",
    "- It does not edit target receipt inputs.",
    "- It does not apply receipts or execute protected actions.",
    "",
    "## Actors",
    "",
  ];
  for (const actor of workbench.actor_workbenches) {
    lines.push(`- ${actor.required_actor}: ${actor.workbench_item_count} item(s), ${actor.pending_prompt_count} pending prompt field(s), ${actor.workbench_html_path}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderActorWorkbenchMarkdown(actor, items) {
  const lines = [
    `# Human Review Receipt Completion Workbench: ${actor.required_actor}`,
    "",
    `- Workbench status: ${actor.workbench_status}`,
    `- Workbench items: ${actor.workbench_item_count}`,
    `- Pending human input: ${actor.pending_human_input_count}`,
    `- Pending prompt fields: ${actor.pending_prompt_count}`,
    `- Completion template: ${actor.receipt_completion_template_path ?? "not available"}`,
    "",
    "## Items",
    "",
  ];
  for (const item of items) {
    lines.push(`### ${item.workbench_rank}. ${item.gate_item_id}`);
    lines.push("");
    lines.push(`- Workbench status: ${item.workbench_status}`);
    lines.push(`- Target receipt input: ${item.target_receipt_input_path ?? "not available"}`);
    lines.push(`- Pending fields: ${item.pending_fields.join(", ") || "none"}`);
    lines.push(`- Instruction: ${item.manual_instruction}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function renderWorkbenchHtml(workbench) {
  return renderHtmlPage({
    title: "Human Review Cycle Receipt Completion Workbench",
    status: workbench.workbench_status,
    metrics: [
      ["Actors", workbench.summary.actor_workbench_count],
      ["Items", workbench.summary.workbench_item_count],
      ["Pending", workbench.summary.pending_human_input_count],
      ["Pending Fields", workbench.summary.pending_prompt_count],
      ["Errors", workbench.summary.validation_error_count],
    ],
    rows: workbench.workbench_items,
    actorLinks: workbench.actor_workbenches.map((actor) => ({
      label: actor.required_actor,
      href: `actors/${actor.required_actor}/completion-workbench.html`,
      count: actor.pending_prompt_count,
    })),
  });
}

function renderActorWorkbenchHtml(actor, items) {
  return renderHtmlPage({
    title: `Human Review Receipt Completion Workbench: ${actor.required_actor}`,
    status: actor.workbench_status,
    metrics: [
      ["Items", actor.workbench_item_count],
      ["Pending", actor.pending_human_input_count],
      ["Ready", actor.ready_for_validation_count],
      ["Pending Fields", actor.pending_prompt_count],
      ["Invalid Fields", actor.invalid_prompt_count],
    ],
    rows: items,
    actorLinks: [{
      label: "Completion Template",
      href: pathToFileHref(actor.receipt_completion_template_path),
      count: actor.field_prompt_count,
    }],
  });
}

function renderHtmlPage({ title, status, metrics, rows, actorLinks }) {
  const metricHtml = metrics.map(([label, value]) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  const actorHtml = actorLinks.map((link) => `<a class="actor-link" href="${escapeHtml(link.href)}">${escapeHtml(link.label)} <span>${escapeHtml(link.count)}</span></a>`).join("");
  const rowHtml = rows.map((item) => `
    <tr>
      <td><span class="badge ${escapeHtml(item.workbench_status)}">${escapeHtml(item.workbench_status)}</span></td>
      <td>${escapeHtml(item.required_actor)}</td>
      <td>${escapeHtml(item.gate_type)}</td>
      <td>${escapeHtml(item.priority)}</td>
      <td>${escapeHtml(item.pending_fields.join(", ") || "none")}</td>
      <td><code>${escapeHtml(item.target_receipt_input_path ?? "")}</code></td>
      <td>${escapeHtml(item.manual_instruction)}</td>
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
    <div class="status">Status: ${escapeHtml(status)}. Read-only workbench; receipt edits remain manual.</div>
  </header>
  <main>
    <section class="metrics">${metricHtml}</section>
    <nav class="actors">${actorHtml}</nav>
    <table>
      <thead><tr><th>Status</th><th>Actor</th><th>Gate</th><th>Priority</th><th>Pending Fields</th><th>Target Receipt Input</th><th>Instruction</th></tr></thead>
      <tbody>${rowHtml}</tbody>
    </table>
  </main>
</body>
</html>
`;
}

function serializableWorkbench(result) {
  return {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    workbench_id: result.workbench_id,
    output_dir: result.output_dir,
    workbench_status: result.workbench_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    actor_workbenches: result.actor_workbenches,
    workbench_items: result.workbench_items,
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

function compareWorkbenchItems(a, b) {
  return (STATUS_ORDER[a.workbench_status] ?? 99) - (STATUS_ORDER[b.workbench_status] ?? 99)
    || (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || a.required_actor.localeCompare(b.required_actor)
    || a.gate_type.localeCompare(b.gate_type)
    || String(a.gate_item_id ?? "").localeCompare(String(b.gate_item_id ?? ""));
}

function compareActorWorkbenches(a, b) {
  return (STATUS_ORDER[a.workbench_status] ?? 99) - (STATUS_ORDER[b.workbench_status] ?? 99)
    || (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || a.required_actor.localeCompare(b.required_actor);
}

function highestPriority(items) {
  return [...items].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99))[0]?.priority ?? "low";
}

function groupBy(items, selector) {
  return items.reduce((groups, item) => {
    const key = selector(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});
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
    else if (arg === "--completion-verification") args.completionVerificationPath = argv[++index];
    else if (arg === "--completion-pack") args.completionPackPath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-receipt-completion-workbench.mjs [options]

Options:
  --completion-verification <path> Human Review Cycle Receipt Completion Verification artifact
  --completion-pack <path>         Human Review Cycle Receipt Completion Pack artifact
  --out-dir <dir>                  Output directory
  --run-at <iso>                   Override generated_at
  --check                          Exit non-zero when structural validation fails
`);
}
