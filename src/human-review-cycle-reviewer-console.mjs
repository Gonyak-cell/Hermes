import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HUMAN_REVIEW_CYCLE_REVIEWER_CONSOLE_OUT_DIR = "artifacts/human-review-cycle-reviewer-console/latest";
export const DEFAULT_HUMAN_REVIEW_CYCLE_REVIEWER_CONSOLE_INPUTS = {
  triageInboxPath: "artifacts/human-review-cycle-triage-inbox/latest/human-review-cycle-triage-inbox.json",
  contextBundlePath: "artifacts/human-review-context-bundle/latest/human-review-context-bundle.json",
  decisionRegisterPath: "artifacts/human-review-decision-register/latest/human-review-decision-register.json",
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
  ready_for_human_review: 2,
  ready_for_application: 3,
  clear: 4,
};

export async function runHumanReviewCycleReviewerConsole(options = {}) {
  const result = await buildHumanReviewCycleReviewerConsole(options);
  if (options.write !== false) await writeHumanReviewCycleReviewerConsole(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Human review cycle reviewer console failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHumanReviewCycleReviewerConsole(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HUMAN_REVIEW_CYCLE_REVIEWER_CONSOLE_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const inputPaths = resolveInputPaths(options);
  const sourceResults = {
    human_review_cycle_triage_inbox: await readJsonOrError(inputPaths.triageInboxPath),
    human_review_context_bundle: await readJsonOrError(inputPaths.contextBundlePath),
    human_review_decision_register: await readJsonOrError(inputPaths.decisionRegisterPath),
  };
  const sources = [
    buildSource("human_review_cycle_triage_inbox", "Human Review Cycle Triage Inbox", inputPaths.triageInboxPath, sourceResults.human_review_cycle_triage_inbox),
    buildSource("human_review_context_bundle", "Human Review Context Bundle", inputPaths.contextBundlePath, sourceResults.human_review_context_bundle),
    buildSource("human_review_decision_register", "Human Review Decision Register", inputPaths.decisionRegisterPath, sourceResults.human_review_decision_register),
  ];
  const consoleItems = buildConsoleItems(sourceResults);
  const actorConsoles = buildActorConsoles(consoleItems, outputDir);
  const validation = validateReviewerConsole({ sources, sourceResults, actorConsoles, consoleItems });
  const console = {
    schema_version: "human-review-cycle-reviewer-console.v1",
    generated_at: generatedAt,
    console_id: `human-review-cycle-reviewer-console.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    console_status: deriveConsoleStatus(validation, consoleItems),
    safe_handling: {
      auto_execute_allowed: false,
      draft_only: true,
      view_only: true,
      protected_actions_executed: false,
      receipt_edits_must_be_manual: true,
    },
    sources,
    summary: summarizeReviewerConsole(actorConsoles, consoleItems, sources, sourceResults, validation),
    actor_consoles: actorConsoles,
    console_items: consoleItems,
    validation,
  };

  return {
    ...console,
    html: renderReviewerConsoleHtml(console),
    markdown: renderReviewerConsoleMarkdown(console),
  };
}

export async function writeHumanReviewCycleReviewerConsole(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "human-review-cycle-reviewer-console.json"), serializableConsole(result));
  await writeJson(path.join(outDir, "console-items.json"), {
    generated_at: result.generated_at,
    count: result.console_items.length,
    console_items: result.console_items,
  });
  await writeJson(path.join(outDir, "actor-consoles.json"), {
    generated_at: result.generated_at,
    count: result.actor_consoles.length,
    actor_consoles: result.actor_consoles,
  });
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  for (const actor of result.actor_consoles) {
    const actorDir = path.join(outDir, "actors", actor.required_actor);
    const items = result.console_items.filter((item) => item.required_actor === actor.required_actor);
    await mkdir(actorDir, { recursive: true });
    await writeJson(path.join(actorDir, "reviewer-console.json"), {
      generated_at: result.generated_at,
      required_actor: actor.required_actor,
      console_status: actor.console_status,
      count: items.length,
      actor_console: actor,
      console_items: items,
    });
    await writeFile(path.join(actorDir, "reviewer-console.md"), renderActorConsoleMarkdown(actor, items), "utf8");
    await writeFile(path.join(actorDir, "index.html"), renderActorConsoleHtml(actor, items, result.generated_at), "utf8");
  }
}

export async function runHumanReviewCycleReviewerConsoleCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHumanReviewCycleReviewerConsole(args);
    console.log(`Human review cycle reviewer console ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Console status: ${result.console_status}`);
    console.log(`Actor consoles: ${result.summary.actor_console_count}`);
    console.log(`Console items: ${result.summary.console_item_count}`);
    console.log(`Ready for human review: ${result.summary.ready_for_human_review_count}`);
    console.log(`Missing context cards: ${result.summary.missing_context_card_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function resolveInputPaths(options) {
  return {
    triageInboxPath: path.resolve(options.triageInboxPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_REVIEWER_CONSOLE_INPUTS.triageInboxPath),
    contextBundlePath: path.resolve(options.contextBundlePath ?? DEFAULT_HUMAN_REVIEW_CYCLE_REVIEWER_CONSOLE_INPUTS.contextBundlePath),
    decisionRegisterPath: path.resolve(options.decisionRegisterPath ?? DEFAULT_HUMAN_REVIEW_CYCLE_REVIEWER_CONSOLE_INPUTS.decisionRegisterPath),
  };
}

function buildConsoleItems(sourceResults) {
  const triageItems = sourceResults.human_review_cycle_triage_inbox.value?.triage_items ?? [];
  const contextByGate = new Map((sourceResults.human_review_context_bundle.value?.context_cards ?? []).map((card) => [card.gate_item_id, card]));
  const decisionByGate = new Map((sourceResults.human_review_decision_register.value?.decision_rows ?? []).map((row) => [row.gate_item_id, row]));
  return triageItems.map((triageItem) => {
    const contextCard = contextByGate.get(triageItem.gate_item_id);
    const decisionRow = decisionByGate.get(triageItem.gate_item_id);
    const title = contextCard?.title ?? decisionRow?.title ?? `Review ${triageItem.gate_type}`;
    return {
      console_item_id: `human-review-cycle-reviewer-console.${slugify(triageItem.gate_item_id)}`,
      triage_item_id: triageItem.triage_item_id,
      triage_rank: triageItem.triage_rank,
      actor_console_id: `human-review-cycle-reviewer-console.actor.${slugify(triageItem.required_actor)}`,
      gate_item_id: triageItem.gate_item_id,
      receipt_id: triageItem.receipt_id,
      required_actor: triageItem.required_actor,
      gate_type: triageItem.gate_type,
      priority: triageItem.priority,
      console_status: deriveConsoleItemStatus(triageItem, contextCard, decisionRow),
      triage_status: triageItem.triage_status,
      protected_action: Boolean(triageItem.protected_action),
      evidence_decision: Boolean(triageItem.evidence_decision),
      target_receipt_input_path: triageItem.target_receipt_input_path,
      target_decision_json_path: triageItem.target_decision_json_path,
      title,
      reason: contextCard?.reason ?? decisionRow?.reason ?? "",
      subject_ref: contextCard?.subject_ref ?? decisionRow?.subject_ref ?? null,
      context_card_id: contextCard?.context_card_id ?? null,
      decision_row_id: decisionRow?.decision_row_id ?? null,
      context_summary: buildContextSummary(contextCard, decisionRow),
      allowed_outcomes: decisionRow?.allowed_outcomes ?? contextCard?.review_contract?.allowed_outcomes ?? [],
      required_receipt_fields: triageItem.required_receipt_fields ?? decisionRow?.required_receipt_fields ?? [],
      missing_required_fields: triageItem.missing_required_fields ?? [],
      mismatch_fields: triageItem.mismatch_fields ?? [],
      receipt_row_status: triageItem.receipt_row_status,
      receipt_row_outcome: triageItem.receipt_row_outcome,
      review_instructions: triageItem.review_instructions ?? [],
      recommended_actions: unique([
        ...(contextCard?.recommended_actions ?? []),
        ...(decisionRow?.recommended_actions ?? []),
        ...(triageItem.next_actions ?? []),
      ]),
      next_commands: unique([...(contextCard?.next_commands ?? []), ...(decisionRow?.decision_fields?.commands_run ?? [])]),
      source_refs: {
        triage_item_id: triageItem.triage_item_id,
        target_audit_item_id: triageItem.target_audit_item_id,
        context_card_id: contextCard?.context_card_id ?? null,
        decision_row_id: decisionRow?.decision_row_id ?? null,
      },
      safe_handling: {
        auto_execute_allowed: false,
        view_only: true,
        protected_actions_executed: false,
        receipt_edits_must_be_manual: true,
      },
    };
  }).sort(compareConsoleItems).map((item, index) => ({ ...item, console_rank: index + 1 }));
}

function buildContextSummary(contextCard, decisionRow) {
  const summary = decisionRow?.context_summary ?? {};
  return {
    gate_title: summary.gate_title ?? contextCard?.gate_context?.title ?? null,
    plan_title: summary.plan_title ?? contextCard?.plan_context?.title ?? null,
    evidence_id: summary.evidence_id ?? contextCard?.evidence_context?.evidence_id ?? null,
    evidence_summary: summary.evidence_summary ?? contextCard?.evidence_context?.summary ?? null,
    approval_item_id: summary.approval_item_id ?? contextCard?.approval_context?.approval_item_id ?? null,
    approval_status: summary.approval_status ?? contextCard?.approval_context?.status ?? null,
    matter_key: summary.matter_key ?? contextCard?.matter_context?.matter_key ?? null,
    matter_status: summary.matter_status ?? contextCard?.matter_context?.status ?? null,
  };
}

function buildActorConsoles(consoleItems, outputDir) {
  return Object.entries(groupBy(consoleItems, (item) => item.required_actor))
    .map(([requiredActor, items]) => ({
      actor_console_id: `human-review-cycle-reviewer-console.actor.${slugify(requiredActor)}`,
      required_actor: requiredActor,
      console_status: deriveActorConsoleStatus(items),
      priority: highestPriority(items),
      console_item_count: items.length,
      ready_for_human_review_count: items.filter((item) => item.console_status === "ready_for_human_review").length,
      ready_for_application_count: items.filter((item) => item.console_status === "ready_for_application").length,
      attention_count: items.filter((item) => item.console_status === "attention").length,
      blocked_count: items.filter((item) => item.console_status === "blocked").length,
      protected_action_count: items.filter((item) => item.protected_action).length,
      evidence_decision_count: items.filter((item) => item.evidence_decision).length,
      target_file_count: new Set(items.map((item) => item.target_receipt_input_path).filter(Boolean)).size,
      missing_context_card_count: items.filter((item) => !item.context_card_id).length,
      missing_decision_row_count: items.filter((item) => !item.decision_row_id).length,
      top_console_item_ids: items.slice(0, 8).map((item) => item.console_item_id),
      console_json_path: path.join(outputDir, "actors", requiredActor, "reviewer-console.json"),
      console_markdown_path: path.join(outputDir, "actors", requiredActor, "reviewer-console.md"),
      console_html_path: path.join(outputDir, "actors", requiredActor, "index.html"),
      safe_handling: {
        auto_execute_allowed: false,
        draft_only: true,
        view_only: true,
        protected_actions_executed: false,
      },
    }))
    .sort(compareActorConsoles);
}

function validateReviewerConsole({ sources, sourceResults, actorConsoles, consoleItems }) {
  const errors = [];
  for (const source of sources) {
    if (!source.available) {
      errors.push({ path: `sources.${source.source_id}`, message: `${source.label} unavailable: ${source.error}` });
    }
  }
  const expectedTriageCount = sourceResults.human_review_cycle_triage_inbox.value?.summary?.triage_item_count ?? 0;
  const expectedActorCount = sourceResults.human_review_cycle_triage_inbox.value?.summary?.actor_triage_inbox_count ?? 0;
  if (expectedTriageCount > 0 && consoleItems.length !== expectedTriageCount) {
    errors.push({ path: "console_items", message: "Console item count must match triage item count." });
  }
  if (expectedActorCount > 0 && actorConsoles.length !== expectedActorCount) {
    errors.push({ path: "actor_consoles", message: "Actor console count must match triage actor inbox count." });
  }
  for (const item of consoleItems) {
    if (!item.context_card_id) {
      errors.push({ path: `console_items.${item.console_item_id}.context_card_id`, message: "Console item is missing context card linkage." });
    }
    if (!item.decision_row_id) {
      errors.push({ path: `console_items.${item.console_item_id}.decision_row_id`, message: "Console item is missing decision row linkage." });
    }
    if (!item.target_receipt_input_path) {
      errors.push({ path: `console_items.${item.console_item_id}.target_receipt_input_path`, message: "Console item is missing target receipt input path." });
    }
    if (item.safe_handling.auto_execute_allowed || item.safe_handling.protected_actions_executed) {
      errors.push({ path: `console_items.${item.console_item_id}.safe_handling`, message: "Reviewer console must not execute protected actions." });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeReviewerConsole(actorConsoles, consoleItems, sources, sourceResults, validation) {
  return {
    console_status: deriveConsoleStatus(validation, consoleItems),
    source_count: sources.length,
    unavailable_source_count: sources.filter((source) => !source.available).length,
    source_triage_item_count: sourceResults.human_review_cycle_triage_inbox.value?.summary?.triage_item_count ?? 0,
    source_context_card_count: sourceResults.human_review_context_bundle.value?.summary?.context_card_count ?? 0,
    source_decision_row_count: sourceResults.human_review_decision_register.value?.summary?.decision_row_count ?? 0,
    actor_console_count: actorConsoles.length,
    console_item_count: consoleItems.length,
    ready_for_human_review_count: consoleItems.filter((item) => item.console_status === "ready_for_human_review").length,
    ready_for_application_count: consoleItems.filter((item) => item.console_status === "ready_for_application").length,
    attention_count: consoleItems.filter((item) => item.console_status === "attention").length,
    blocked_count: consoleItems.filter((item) => item.console_status === "blocked").length,
    protected_action_count: consoleItems.filter((item) => item.protected_action).length,
    evidence_decision_count: consoleItems.filter((item) => item.evidence_decision).length,
    target_file_count: new Set(consoleItems.map((item) => item.target_receipt_input_path).filter(Boolean)).size,
    missing_context_card_count: consoleItems.filter((item) => !item.context_card_id).length,
    missing_decision_row_count: consoleItems.filter((item) => !item.decision_row_id).length,
    validation_error_count: validation.errors.length,
    by_required_actor: countBy(consoleItems, "required_actor"),
    by_gate_type: countBy(consoleItems, "gate_type"),
    by_console_status: countBy(consoleItems, "console_status"),
    by_priority: countBy(consoleItems, "priority"),
  };
}

function deriveConsoleStatus(validation, consoleItems) {
  if (!validation.valid) return "blocked";
  if (consoleItems.some((item) => item.console_status === "blocked")) return "blocked";
  if (consoleItems.some((item) => item.console_status === "attention")) return "attention";
  if (consoleItems.some((item) => item.console_status === "ready_for_human_review")) return "ready_for_human_review";
  if (consoleItems.some((item) => item.console_status === "ready_for_application")) return "ready_for_application";
  return "clear";
}

function deriveActorConsoleStatus(items) {
  if (items.some((item) => item.console_status === "blocked")) return "blocked";
  if (items.some((item) => item.console_status === "attention")) return "attention";
  if (items.some((item) => item.console_status === "ready_for_human_review")) return "ready_for_human_review";
  if (items.some((item) => item.console_status === "ready_for_application")) return "ready_for_application";
  return "clear";
}

function deriveConsoleItemStatus(triageItem, contextCard, decisionRow) {
  if (triageItem.triage_status === "blocked" || !contextCard || !decisionRow) return "blocked";
  if (triageItem.triage_status === "attention") return "attention";
  if (triageItem.triage_status === "ready_for_application") return "ready_for_application";
  if (triageItem.triage_status === "ready_for_human_review") return "ready_for_human_review";
  return "clear";
}

function renderReviewerConsoleMarkdown(console) {
  const lines = [
    "# Human Review Cycle Reviewer Console",
    "",
    `- Console status: ${console.console_status}`,
    `- Actor consoles: ${console.summary.actor_console_count}`,
    `- Console items: ${console.summary.console_item_count}`,
    `- Ready for human review: ${console.summary.ready_for_human_review_count}`,
    `- Missing context cards: ${console.summary.missing_context_card_count}`,
    `- Missing decision rows: ${console.summary.missing_decision_row_count}`,
    `- Validation errors: ${console.summary.validation_error_count}`,
    "",
    "## Safe Handling",
    "",
    "- This console is view-only.",
    "- It does not edit receipts or execute protected actions.",
    "- Target receipt inputs must be edited by a human reviewer.",
    "",
    "## Actor Consoles",
    "",
  ];
  for (const actor of console.actor_consoles) {
    lines.push(`- ${actor.required_actor}: ${actor.console_item_count} item(s), ${actor.ready_for_human_review_count} ready, ${actor.console_html_path}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderActorConsoleMarkdown(actor, items) {
  const lines = [
    `# Human Review Cycle Reviewer Console: ${actor.required_actor}`,
    "",
    `- Console status: ${actor.console_status}`,
    `- Console items: ${actor.console_item_count}`,
    `- Ready for human review: ${actor.ready_for_human_review_count}`,
    `- Attention: ${actor.attention_count}`,
    `- Blocked: ${actor.blocked_count}`,
    "",
    "## Items",
    "",
  ];
  for (const item of items) {
    lines.push(`### ${item.console_rank}. ${item.title}`);
    lines.push("");
    lines.push(`- Status: ${item.console_status}`);
    lines.push(`- Gate type: ${item.gate_type}`);
    lines.push(`- Priority: ${item.priority}`);
    lines.push(`- Target receipt input: ${item.target_receipt_input_path ?? "not available"}`);
    lines.push(`- Required fields: ${item.required_receipt_fields.join(", ")}`);
    lines.push(`- Allowed outcomes: ${item.allowed_outcomes.join(", ")}`);
    if (item.reason) lines.push(`- Reason: ${item.reason}`);
    if (item.context_summary.evidence_summary) lines.push(`- Evidence: ${item.context_summary.evidence_summary}`);
    if (item.context_summary.matter_key) lines.push(`- Matter: ${item.context_summary.matter_key} (${item.context_summary.matter_status ?? "unknown"})`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function renderReviewerConsoleHtml(console) {
  const actorLinks = console.actor_consoles.map((actor) => `<a class="actor-link" href="actors/${escapeHtml(actor.required_actor)}/index.html">${escapeHtml(actor.required_actor)} <span>${actor.ready_for_human_review_count}/${actor.console_item_count}</span></a>`).join("");
  const items = console.console_items.slice(0, 80).map(renderConsoleItemHtml).join("");
  return htmlPage("Human Review Cycle Reviewer Console", console.generated_at, `
    <section class="stats">
      ${stat("Actors", console.summary.actor_console_count)}
      ${stat("Items", console.summary.console_item_count)}
      ${stat("Ready", console.summary.ready_for_human_review_count)}
      ${stat("Protected", console.summary.protected_action_count)}
      ${stat("Evidence", console.summary.evidence_decision_count)}
      ${stat("Errors", console.summary.validation_error_count)}
    </section>
    <section class="panel">
      <h2>Actor Consoles</h2>
      <div class="actor-grid">${actorLinks}</div>
    </section>
    <section class="panel">
      <h2>Top Review Items</h2>
      ${items || "<p>No review items.</p>"}
    </section>
  `);
}

function renderActorConsoleHtml(actor, items, generatedAt) {
  return htmlPage(`Reviewer Console: ${actor.required_actor}`, generatedAt, `
    <section class="stats">
      ${stat("Items", actor.console_item_count)}
      ${stat("Ready", actor.ready_for_human_review_count)}
      ${stat("Attention", actor.attention_count)}
      ${stat("Blocked", actor.blocked_count)}
      ${stat("Files", actor.target_file_count)}
    </section>
    <section class="panel">
      <h2>Review Queue</h2>
      ${items.map(renderConsoleItemHtml).join("") || "<p>No review items.</p>"}
    </section>
  `);
}

function renderConsoleItemHtml(item) {
  return `<article class="item">
    <div class="item-head">
      <h3>${escapeHtml(item.console_rank)}. ${escapeHtml(item.title)}</h3>
      <span class="badge status-${escapeHtml(item.console_status)}">${escapeHtml(item.console_status)}</span>
    </div>
    <div class="chips">
      <span>${escapeHtml(item.required_actor)}</span>
      <span>${escapeHtml(item.gate_type)}</span>
      <span>${escapeHtml(item.priority)}</span>
      ${item.protected_action ? "<span>protected</span>" : ""}
    </div>
    <p>${escapeHtml(item.reason || "No reason provided.")}</p>
    <dl>
      <dt>Receipt input</dt><dd><code>${escapeHtml(item.target_receipt_input_path ?? "not available")}</code></dd>
      <dt>Required fields</dt><dd>${escapeHtml(item.required_receipt_fields.join(", ") || "none")}</dd>
      <dt>Allowed outcomes</dt><dd>${escapeHtml(item.allowed_outcomes.join(", ") || "unknown")}</dd>
      <dt>Evidence</dt><dd>${escapeHtml(item.context_summary.evidence_summary ?? "none")}</dd>
      <dt>Matter</dt><dd>${escapeHtml(item.context_summary.matter_key ?? "none")}</dd>
    </dl>
  </article>`;
}

function htmlPage(title, generatedAt, body) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; --ink:#1f2937; --muted:#667085; --line:#d0d5dd; --panel:#f8fafc; --accent:#0f766e; --danger:#b42318; --warn:#a15c00; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:#fff; }
    header { padding:28px 32px 18px; border-bottom:1px solid var(--line); }
    main { max-width:1180px; margin:0 auto; padding:22px 32px 44px; }
    h1 { margin:0 0 6px; font-size:28px; line-height:1.2; }
    h2 { margin:0 0 14px; font-size:18px; }
    h3 { margin:0; font-size:16px; }
    .meta { color:var(--muted); font-size:13px; }
    .stats { display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin:0 0 18px; }
    .stat { border:1px solid var(--line); background:var(--panel); border-radius:8px; padding:12px; }
    .stat strong { display:block; font-size:24px; }
    .stat span { display:block; color:var(--muted); font-size:12px; }
    .panel { border-top:1px solid var(--line); padding-top:18px; margin-top:18px; }
    .actor-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px; }
    .actor-link { display:flex; justify-content:space-between; gap:10px; padding:12px; border:1px solid var(--line); border-radius:8px; color:var(--ink); text-decoration:none; background:#fff; }
    .actor-link span { color:var(--accent); font-weight:700; }
    .item { border:1px solid var(--line); border-radius:8px; padding:14px; margin:12px 0; background:#fff; }
    .item-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
    .badge, .chips span { display:inline-flex; align-items:center; border:1px solid var(--line); border-radius:999px; padding:3px 8px; font-size:12px; color:var(--muted); background:#fff; }
    .status-blocked { color:var(--danger); border-color:#fecdca; background:#fff5f5; }
    .status-attention { color:var(--warn); border-color:#fedf89; background:#fffbeb; }
    .status-ready_for_human_review { color:var(--accent); border-color:#99f6e4; background:#f0fdfa; }
    .chips { display:flex; flex-wrap:wrap; gap:6px; margin:10px 0; }
    p { overflow-wrap:anywhere; }
    dl { display:grid; grid-template-columns:minmax(110px, 160px) 1fr; gap:8px 12px; margin:12px 0 0; }
    dt { color:var(--muted); font-size:13px; }
    dd { margin:0; overflow-wrap:anywhere; }
    code { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; }
    @media (max-width: 640px) { header, main { padding-left:18px; padding-right:18px; } h1 { font-size:23px; } dl { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">Generated ${escapeHtml(generatedAt)}</div>
  </header>
  <main>${body}</main>
</body>
</html>
`;
}

function stat(label, value) {
  return `<div class="stat"><strong>${Number(value ?? 0)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function serializableConsole(result) {
  return {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    console_id: result.console_id,
    output_dir: result.output_dir,
    console_status: result.console_status,
    safe_handling: result.safe_handling,
    sources: result.sources,
    summary: result.summary,
    actor_consoles: result.actor_consoles,
    console_items: result.console_items,
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

function compareConsoleItems(a, b) {
  return (STATUS_ORDER[a.console_status] ?? 99) - (STATUS_ORDER[b.console_status] ?? 99)
    || (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    || a.required_actor.localeCompare(b.required_actor)
    || a.gate_type.localeCompare(b.gate_type)
    || String(a.gate_item_id ?? "").localeCompare(String(b.gate_item_id ?? ""));
}

function compareActorConsoles(a, b) {
  return (STATUS_ORDER[a.console_status] ?? 99) - (STATUS_ORDER[b.console_status] ?? 99)
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

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))];
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
    else if (arg === "--check") {
      args.check = true;
      args.write = false;
    }
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--triage-inbox") args.triageInboxPath = argv[++index];
    else if (arg === "--context-bundle") args.contextBundlePath = argv[++index];
    else if (arg === "--decision-register") args.decisionRegisterPath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/human-review-cycle-reviewer-console.mjs [options]

Options:
  --triage-inbox <path>      Human Review Cycle Triage Inbox artifact
  --context-bundle <path>    Human Review Context Bundle artifact
  --decision-register <path> Human Review Decision Register artifact
  --out-dir <dir>            Output directory
  --run-at <iso>             Override generated_at
  --check                    Exit non-zero when validation fails
`);
}
